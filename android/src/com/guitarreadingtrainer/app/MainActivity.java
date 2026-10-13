package com.guitarreadingtrainer.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A WebView around the single-file build (android/assets/index.html). The page
 * carries its own guitar samples and fonts, so the app works offline and needs
 * no permissions; progress lives in the WebView's localStorage.
 *
 * The page is drawn edge to edge. The system bar insets are handed to it as
 * the CSS variables --safe-top and --safe-bottom (styles.css), and the page
 * reports its theme through window.AndroidTheme so the bar icons stay readable.
 */
public class MainActivity extends Activity {
    private WebView web;
    private int insetTop = 0;
    private int insetBottom = 0;
    private boolean dark = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#14181F"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new ThemeBridge(), "AndroidTheme");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pushInsets();
            }
        });
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                insetTop = i.top;
                insetBottom = i.bottom;
            } else {
                insetTop = insets.getSystemWindowInsetTop();
                insetBottom = insets.getSystemWindowInsetBottom();
            }
            pushInsets();
            return insets;
        });
        setContentView(web);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/index.html");
    }

    /** Insets in CSS pixels onto the page root, so the layout keeps clear of the system bars. */
    private void pushInsets() {
        float density = getResources().getDisplayMetrics().density;
        int top = Math.round(insetTop / density);
        int bottom = Math.round(insetBottom / density);
        web.evaluateJavascript(
            "document.documentElement.style.setProperty('--safe-top','" + top + "px');"
            + "document.documentElement.style.setProperty('--safe-bottom','" + bottom + "px');", null);
    }

    private void applyBarAppearance() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c == null) return;
            int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            c.setSystemBarsAppearance(dark ? 0 : light, light);
        } else {
            View d = w.getDecorView();
            int flags = d.getSystemUiVisibility();
            int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            d.setSystemUiVisibility(dark ? (flags & ~light) : (flags | light));
        }
    }

    private class ThemeBridge {
        @JavascriptInterface
        public void set(boolean isDark) {
            dark = isDark;
            runOnUiThread(MainActivity.this::applyBarAppearance);
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }
}
