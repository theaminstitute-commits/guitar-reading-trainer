// Staff & Strings for Windows: the setup program. One .exe that installs, updates and removes
// the app for the current user (no administrator rights): the launcher and the single-file app
// in %LOCALAPPDATA%\Programs\StaffAndStrings, a Start menu shortcut (and a desktop one if
// wanted), and an entry in Settings > Apps with an uninstaller. Progress lives in the app's own
// browser profile in %LOCALAPPDATA%\StaffAndStrings, which updates leave alone and uninstalling
// removes only when asked.
//
//   setup.exe                 install or update, with a window
//   setup.exe /S              install or update silently (desktop shortcut, no launch)
//   uninstall.exe /uninstall  remove, with a window; add /S for silent, /purge to delete progress too
//
// Built by windows\build-exe.ps1 with the C# compiler that ships with Windows (.NET Framework 4).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Management;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class Setup
{
    public const string AppName = "Staff & Strings";
    public const string Publisher = "Dirk Swanepoel";
    public const string Website = "https://theaminstitute-commits.github.io/guitar-reading-trainer/";
    const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\StaffAndStrings";

    static string LocalAppData { get { return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); } }
    public static string InstallDir { get { return Path.Combine(LocalAppData, "Programs", "StaffAndStrings"); } }
    /// <summary>The app's browser profile: progress, settings and lessons done.</summary>
    public static string DataDir { get { return Path.Combine(LocalAppData, "StaffAndStrings"); } }
    static string LauncherPath { get { return Path.Combine(InstallDir, "Staff & Strings.exe"); } }
    static string UninstallerPath { get { return Path.Combine(InstallDir, "uninstall.exe"); } }
    static string IconPath { get { return Path.Combine(InstallDir, "staff-and-strings.ico"); } }
    static string StartMenuShortcut { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"); } }
    static string DesktopShortcut { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"); } }

    [STAThread]
    static int Main(string[] argv)
    {
        var args = new HashSet<string>(argv.Select(a => a.ToLowerInvariant()));
        bool silent = args.Contains("/s");
        bool uninstall = args.Contains("/uninstall");
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try
        {
            if (uninstall)
            {
                // An uninstaller cannot delete the folder it runs from: hand the removal to a copy in the
                // temp folder and exit at once; the copy waits for this process to end before deleting.
                string self = Application.ExecutablePath;
                string parent = argv.FirstOrDefault(a => a.StartsWith("/parent=", StringComparison.OrdinalIgnoreCase));
                if (parent == null)
                {
                    string copy = Path.Combine(Path.GetTempPath(), "StaffAndStrings-uninstall-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
                    File.Copy(self, copy, true);
                    var rest = string.Join(" ", argv.Concat(new[] { "/parent=" + Process.GetCurrentProcess().Id }));
                    Process.Start(new ProcessStartInfo(copy, rest) { UseShellExecute = false, WorkingDirectory = Path.GetTempPath() });
                    return 0;
                }
                try
                {
                    WaitForExit(parent.Substring("/parent=".Length));
                    if (silent)
                    {
                        CloseRunningApp();
                        Uninstall(args.Contains("/purge"));
                    }
                    else Application.Run(new SetupForm(true));
                    return 0;
                }
                finally
                {
                    DeleteLater(self);
                }
            }
            if (silent)
            {
                Install(true);
                return 0;
            }
            Application.Run(new SetupForm(false));
            return 0;
        }
        catch (Exception e)
        {
            if (!silent) MessageBox.Show(e.Message, AppName + " Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    /// <summary>Wait (up to 15 s) for the process that started this one to end, so its file is free to delete.</summary>
    static void WaitForExit(string pid)
    {
        int id;
        if (!int.TryParse(pid, out id)) return;
        try { Process.GetProcessById(id).WaitForExit(15000); }
        catch (ArgumentException) { }
    }

    /// <summary>The version installed now, or null.</summary>
    public static string InstalledVersion()
    {
        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(UninstallKey))
        {
            string version = key == null ? null : key.GetValue("DisplayVersion") as string;
            return version != null && File.Exists(LauncherPath) ? version : null;
        }
    }

    public static Stream Resource(string name)
    {
        Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
        if (s == null) throw new InvalidOperationException("Setup is missing its " + name + ".");
        return s;
    }

    static void Extract(string name, string path)
    {
        string temp = path + ".new";
        using (Stream from = Resource(name))
        using (FileStream to = File.Create(temp))
            from.CopyTo(to);
        if (File.Exists(path)) File.Delete(path);
        File.Move(temp, path);
    }

    /// <summary>Install or update. Progress (the browser profile) is never touched here.</summary>
    public static void Install(bool desktopShortcut)
    {
        Directory.CreateDirectory(Path.Combine(InstallDir, "app"));
        Extract("app.html", Path.Combine(InstallDir, "app", "staff-and-strings.html"));
        Extract("launcher.exe", LauncherPath);
        Extract("app.ico", IconPath);
        Extract("LICENSE.md", Path.Combine(InstallDir, "LICENSE.md"));
        string self = Application.ExecutablePath;
        if (!string.Equals(Path.GetFullPath(self), Path.GetFullPath(UninstallerPath), StringComparison.OrdinalIgnoreCase))
            File.Copy(self, UninstallerPath, true);

        Shortcut(StartMenuShortcut);
        if (desktopShortcut) Shortcut(DesktopShortcut);
        else if (File.Exists(DesktopShortcut)) File.Delete(DesktopShortcut);

        long bytes = new DirectoryInfo(InstallDir).GetFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallKey))
        {
            key.SetValue("DisplayName", AppName);
            key.SetValue("DisplayVersion", BuildInfo.Version);
            key.SetValue("Publisher", Publisher);
            key.SetValue("DisplayIcon", IconPath);
            key.SetValue("InstallLocation", InstallDir);
            key.SetValue("UninstallString", "\"" + UninstallerPath + "\" /uninstall");
            key.SetValue("QuietUninstallString", "\"" + UninstallerPath + "\" /uninstall /S");
            key.SetValue("URLInfoAbout", Website);
            key.SetValue("HelpLink", Website);
            key.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
            key.SetValue("EstimatedSize", (int)(bytes / 1024), RegistryValueKind.DWord);
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }

    public static void Launch()
    {
        Process.Start(new ProcessStartInfo(LauncherPath) { UseShellExecute = true, WorkingDirectory = InstallDir });
    }

    /// <summary>Remove the app, its shortcuts and its Settings entry; the progress too when asked.</summary>
    public static void Uninstall(bool purgeProgress)
    {
        foreach (string link in new[] { StartMenuShortcut, DesktopShortcut })
            if (File.Exists(link)) File.Delete(link);
        Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
        DeleteFolder(InstallDir);
        if (purgeProgress) DeleteFolder(DataDir);
    }

    static void DeleteFolder(string dir)
    {
        for (int attempt = 0; attempt < 10 && Directory.Exists(dir); attempt++)
        {
            try { Directory.Delete(dir, true); }
            catch (IOException) { Thread.Sleep(300); }
            catch (UnauthorizedAccessException) { Thread.Sleep(300); }
        }
        if (Directory.Exists(dir)) throw new IOException("Could not delete " + dir + ". Close Staff & Strings and try again.");
    }

    /// <summary>Browser processes running the app's own profile (an open Staff & Strings window).</summary>
    public static List<int> RunningApp()
    {
        var ids = new List<int>();
        string marker = DataDir.ToLowerInvariant();
        try
        {
            using (var search = new ManagementObjectSearcher("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'msedge.exe' OR Name = 'chrome.exe'"))
                foreach (ManagementObject p in search.Get())
                {
                    string line = p["CommandLine"] as string;
                    if (line != null && line.ToLowerInvariant().Contains(marker)) ids.Add(Convert.ToInt32(p["ProcessId"]));
                }
        }
        catch (ManagementException) { }
        return ids;
    }

    public static void CloseRunningApp()
    {
        foreach (int id in RunningApp())
        {
            try { Process.GetProcessById(id).Kill(); } catch (ArgumentException) { } catch (InvalidOperationException) { } catch (System.ComponentModel.Win32Exception) { }
        }
        for (int i = 0; i < 20 && RunningApp().Count > 0; i++) Thread.Sleep(250);
    }

    static void Shortcut(string path)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(shellType);
        object link = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { path });
        Type t = link.GetType();
        t.InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { LauncherPath });
        t.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link, new object[] { InstallDir });
        t.InvokeMember("IconLocation", BindingFlags.SetProperty, null, link, new object[] { IconPath + ",0" });
        t.InvokeMember("Description", BindingFlags.SetProperty, null, link, new object[] { "Learn to read music on guitar or bass" });
        t.InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
    }

    /// <summary>Delete this temporary uninstaller a moment after it exits.</summary>
    static void DeleteLater(string path)
    {
        Process.Start(new ProcessStartInfo("cmd.exe", "/c ping 127.0.0.1 -n 3 > nul & del /f /q \"" + path + "\"")
        {
            CreateNoWindow = true,
            UseShellExecute = false,
            WindowStyle = ProcessWindowStyle.Hidden,
        });
    }
}

/// <summary>The setup window: install or update, or remove. Plain Windows controls, the app's colours in the header.</summary>
class SetupForm : Form
{
    static readonly Color Ink = Color.FromArgb(0x1c, 0x1a, 0x17);
    static readonly Color Amber = Color.FromArgb(0xe0, 0xa8, 0x4a);
    static readonly Color Paper = Color.FromArgb(0xf1, 0xec, 0xe4);
    static readonly Color Muted = Color.FromArgb(0x5f, 0x58, 0x4e);

    readonly bool removing;
    readonly Label subtitle = new Label();
    readonly Label message = new Label();
    readonly Label detail = new Label();
    readonly CheckBox optionA = new CheckBox();
    readonly CheckBox optionB = new CheckBox();
    readonly LinkLabel licence = new LinkLabel();
    readonly Label status = new Label();
    readonly Button primary = new Button();
    readonly Button secondary = new Button();
    bool finished;

    public SetupForm(bool removing)
    {
        this.removing = removing;
        SuspendLayout();
        AutoScaleDimensions = new SizeF(96F, 96F);
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI", 9.5F);
        Text = removing ? "Remove " + Setup.AppName : Setup.AppName + " Setup";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(540, 380);
        BackColor = Color.White;
        using (Stream s = Setup.Resource("app.ico")) Icon = new Icon(s);

        // Header: the app icon and name on the app's dark ink.
        var header = new Panel { Location = new Point(0, 0), Size = new Size(540, 96), BackColor = Ink };
        var logo = new PictureBox { Location = new Point(24, 18), Size = new Size(60, 60), SizeMode = PictureBoxSizeMode.Zoom, BackColor = Ink };
        using (Stream s = Setup.Resource("icon-256.png")) logo.Image = new Bitmap(s);
        var title = new Label { Text = Setup.AppName, Location = new Point(100, 20), AutoSize = true, ForeColor = Paper, Font = new Font("Segoe UI Semibold", 17F), BackColor = Ink };
        subtitle.Location = new Point(103, 58);
        subtitle.AutoSize = true;
        subtitle.ForeColor = Amber;
        subtitle.BackColor = Ink;
        header.Controls.AddRange(new Control[] { logo, title, subtitle });

        message.Location = new Point(24, 116);
        message.Size = new Size(492, 44);
        detail.Location = new Point(24, 166);
        detail.Size = new Size(492, 44);
        detail.ForeColor = Muted;
        optionA.Location = new Point(24, 222);
        optionA.AutoSize = true;
        optionB.Location = new Point(24, 250);
        optionB.AutoSize = true;
        licence.Location = new Point(24, 290);
        licence.AutoSize = true;
        licence.LinkColor = Color.FromArgb(0x1f, 0x6f, 0xb2);
        licence.LinkClicked += (o, e) => ShowLicence();

        // Footer: a light band with the buttons, as Windows installers have.
        var footer = new Panel { Location = new Point(0, 320), Size = new Size(540, 60), BackColor = Color.FromArgb(0xf3, 0xf3, 0xf3) };
        status.Location = new Point(24, 20);
        status.Size = new Size(260, 22);
        status.ForeColor = Muted;
        primary.Location = new Point(316, 15);
        primary.Size = new Size(100, 30);
        secondary.Location = new Point(424, 15);
        secondary.Size = new Size(92, 30);
        primary.Click += (o, e) => OnPrimary();
        secondary.Click += (o, e) => Close();
        footer.Controls.AddRange(new Control[] { status, primary, secondary });

        Controls.AddRange(new Control[] { header, message, detail, optionA, optionB, licence, footer });
        foreach (Label l in new[] { title, subtitle, message, detail, status }) l.UseMnemonic = false;
        optionA.UseMnemonic = false;
        optionB.UseMnemonic = false;
        AcceptButton = primary;
        CancelButton = secondary;
        ResumeLayout(false);
        ShowStart();
    }

    void ShowStart()
    {
        string installed = Setup.InstalledVersion();
        secondary.Text = "Cancel";
        if (removing)
        {
            subtitle.Text = "Remove from this PC";
            message.Text = "This removes Staff & Strings, its Start menu and desktop shortcuts, and its entry in Settings > Apps.";
            detail.Text = "Your progress (stages, lessons and settings) is kept unless you tick the box below, so a later install picks up where you left off.";
            optionA.Text = "Also delete my progress";
            optionA.Checked = false;
            optionB.Visible = false;
            licence.Visible = false;
            primary.Text = "Remove";
            return;
        }
        subtitle.Text = "Version " + BuildInfo.Version + " · guitar and bass";
        message.Text = "Learn to read music on guitar or bass: hear a melody on the fretboard, write it on the staff, and learn from every mistake. Works offline.";
        if (installed != null)
            detail.Text = installed == BuildInfo.Version
                ? "Version " + installed + " is already installed. Setup will reinstall it; your progress is kept."
                : "Version " + installed + " is installed. Setup will update it to " + BuildInfo.Version + "; your progress is kept.";
        else detail.Text = "Installs for you only, no administrator rights needed, in:\n" + Setup.InstallDir;
        optionA.Text = "Add a shortcut to the desktop";
        optionA.Checked = installed == null || File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Setup.AppName + ".lnk"));
        optionB.Text = "Open Staff & Strings when setup finishes";
        optionB.Checked = true;
        licence.Text = "Free for non-commercial use: PolyForm Noncommercial 1.0.0";
        licence.LinkArea = new LinkArea(licence.Text.IndexOf("PolyForm"), "PolyForm Noncommercial 1.0.0".Length);
        primary.Text = installed == null ? "Install" : installed == BuildInfo.Version ? "Reinstall" : "Update";
    }

    void OnPrimary()
    {
        if (finished)
        {
            if (!removing && optionB.Checked) Setup.Launch();
            Close();
            return;
        }
        primary.Enabled = false;
        secondary.Enabled = false;
        status.ForeColor = Muted;
        status.Text = removing ? "Removing…" : "Installing…";
        Refresh();
        try
        {
            if (removing)
            {
                if (Setup.RunningApp().Count > 0)
                {
                    var answer = MessageBox.Show(this, "Staff & Strings is open. Close it and continue?", Text, MessageBoxButtons.OKCancel, MessageBoxIcon.Question);
                    if (answer != DialogResult.OK) { Reset(); return; }
                    Setup.CloseRunningApp();
                }
                Setup.Uninstall(optionA.Checked);
                subtitle.Text = "Removed";
                message.Text = "Staff & Strings has been removed from this PC.";
                detail.Text = optionA.Checked ? "Your progress was deleted too." : "Your progress is kept in " + Setup.DataDir + " for a later install.";
                optionA.Visible = false;
            }
            else
            {
                Setup.Install(optionA.Checked);
                subtitle.Text = "Version " + BuildInfo.Version + " is installed";
                message.Text = "Staff & Strings is ready. Find it in the Start menu" + (optionA.Checked ? " or on the desktop." : ".");
                detail.Text = "It opens in its own window and works offline. Run this setup again for a later version; your progress is kept. To remove it, use Settings > Apps.";
                optionA.Visible = false;
                licence.Visible = false;
            }
            finished = true;
            status.Text = "";
            primary.Text = removing ? "Close" : "Finish";
            primary.Enabled = true;
            secondary.Visible = false;
            primary.Location = new Point(416, primary.Location.Y);
            primary.Focus();
        }
        catch (Exception e)
        {
            status.ForeColor = Color.FromArgb(0xb4, 0x23, 0x18);
            status.Text = "Something went wrong.";
            MessageBox.Show(this, e.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Reset();
        }
    }

    void Reset()
    {
        status.Text = "";
        primary.Enabled = true;
        secondary.Enabled = true;
    }

    void ShowLicence()
    {
        string path = Path.Combine(Path.GetTempPath(), "Staff and Strings - LICENSE.txt");
        using (Stream from = Setup.Resource("LICENSE.md"))
        using (FileStream to = File.Create(path))
            from.CopyTo(to);
        Process.Start(new ProcessStartInfo("notepad.exe", "\"" + path + "\"") { UseShellExecute = false });
    }
}
