// Staff & Strings for Windows: the launcher. It opens the installed single-file app in its
// own browser window (Edge, else Chrome, in app mode with a private profile so progress is
// kept and nothing mixes with the user's own browsing), or in the default browser if neither
// is installed. Built by windows\build-exe.ps1 with the C# compiler that ships with Windows.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

static class Launcher
{
    const string AppName = "Staff & Strings";

    [STAThread]
    static void Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string page = Path.Combine(dir, "app", "staff-and-strings.html");
        if (!File.Exists(page))
        {
            MessageBox.Show("The app files are missing from\n" + dir + "\n\nPlease run the Staff & Strings setup again.", AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        string url = new Uri(page).AbsoluteUri;
        string browser = Find("msedge.exe", @"Microsoft\Edge\Application\msedge.exe") ?? Find("chrome.exe", @"Google\Chrome\Application\chrome.exe");
        try
        {
            if (browser == null)
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                return;
            }
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StaffAndStrings", "Browser");
            Directory.CreateDirectory(profile);
            // A tall, narrow window like a music stand, centred, never taller than the screen.
            Rectangle area = Screen.PrimaryScreen.WorkingArea;
            int height = Math.Min(980, area.Height - 40);
            int width = Math.Min(760, area.Width - 40);
            int left = area.Left + (area.Width - width) / 2;
            int top = area.Top + (area.Height - height) / 2;
            string args = string.Format(
                "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size={2},{3} --window-position={4},{5} --no-first-run --no-default-browser-check --disable-features=msEdgeSidebarV2",
                url, profile, width, height, left, top);
            Process.Start(new ProcessStartInfo(browser, args) { UseShellExecute = false });
        }
        catch (Exception e)
        {
            MessageBox.Show("Staff & Strings could not open a browser window.\n\n" + e.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    /// <summary>A browser's full path: from Windows' App Paths list, else its usual install folders.</summary>
    static string Find(string exe, string relative)
    {
        foreach (RegistryKey root in new[] { Registry.CurrentUser, Registry.LocalMachine })
        {
            using (RegistryKey key = root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
            {
                string path = key == null ? null : key.GetValue(null) as string;
                if (!string.IsNullOrEmpty(path) && File.Exists(path.Trim('"'))) return path.Trim('"');
            }
        }
        foreach (Environment.SpecialFolder folder in new[] { Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.LocalApplicationData })
        {
            string path = Path.Combine(Environment.GetFolderPath(folder), relative);
            if (File.Exists(path)) return path;
        }
        return null;
    }
}
