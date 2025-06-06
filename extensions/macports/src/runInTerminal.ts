import { closeMainWindow, getApplications, type Image } from "@raycast/api";
import { runAppleScript, showFailureToast, useCachedPromise } from "@raycast/utils";
import { getPreferenceValues } from "@raycast/api";

const preferences = getPreferenceValues();
type TerminalApp = (typeof preferences)["terminalApp"];

const names: { [key in TerminalApp]: string } = {
  alacritty: "Alacritty",
  ghostty: "Ghostty",
  hyper: "Hyper",
  iterm: "iTerm",
  kitty: "kitty",
  terminal: "Terminal",
  warp: "Warp",
  wezterm: "WezTerm",
};

const icons: { [key in TerminalApp]: Image.ImageLike } = {
  alacritty: { fileIcon: "/Applications/Alacritty.app" },
  ghostty: { fileIcon: "/Applications/Ghostty.app" },
  hyper: { fileIcon: "/Applications/Hyper.app" },
  iterm: { fileIcon: "/Applications/iTerm.app" },
  kitty: { fileIcon: "/Applications/kitty.app" },
  terminal: { fileIcon: "/System/Applications/Utilities/Terminal.app" },
  warp: { fileIcon: "/Applications/Warp.app" },
  wezterm: { fileIcon: "/Applications/WezTerm.app" },
};

const appBundleIds: { [key in TerminalApp]: string } = {
  alacritty: "org.alacritty",
  ghostty: "com.mitchellh.ghostty",
  hyper: "co.zeit.hyper",
  iterm: "com.googlecode.iterm2",
  kitty: "org.kovidgoyal.kitty",
  terminal: "com.apple.terminal",
  warp: "dev.warp.Warp-Stable",
  wezterm: "com.github.wez.wezterm",
};

function escapeAppleScriptString(str: string): string {
  return str.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n");
}

function escapeShellCommand(str: string): string {
  return str.replace(/(['"\\$`])/g, "\\$1");
}

const runCommandInTermAppleScript = (c: string, terminalApp: string): string => {
  const escapedCommand = escapeAppleScriptString(escapeShellCommand(c));
  return `
    tell application "${terminalApp}" to activate
    tell application "System Events" to tell process "${terminalApp}"
        keystroke "t" using command down
        delay 0.5
        keystroke "${escapedCommand}"
        keystroke return
    end tell
  `;
};

const appleScripts: { [key in TerminalApp]: (c: string) => string } = {
  alacritty: (c: string) => runCommandInTermAppleScript(c, names.alacritty),
  ghostty: (c: string) => runCommandInTermAppleScript(c, names.ghostty),
  hyper: (c: string) => runCommandInTermAppleScript(c, names.hyper),
  iterm: (c: string) => {
    const escapedCommand = escapeAppleScriptString(escapeShellCommand(c));
    return `
    tell application "iTerm"
      set newWindow to create window with default profile command "bash -c '${escapedCommand}; read -n 1 -s -r -p \\"Press any key to exit - will not quit\\" ; echo' ; exit"
    end tell
    `;
  },
  kitty: (c: string) => runCommandInTermAppleScript(c, names.kitty),
  terminal: (c: string) => {
    const escapedCommand = escapeAppleScriptString(escapeShellCommand(c));
    return `
    tell application "Terminal"
      do shell script "open -a 'Terminal'"
      do script "echo ; ${escapedCommand} ; bash -c 'read -n 1 -s -r -p \\"Press any key to exit - will not quit\\"' ; exit" in selected tab of the front window
    end tell
    `;
  },
  warp: (c: string) => runCommandInTermAppleScript(c, names.warp),
  wezterm: (c: string) => runCommandInTermAppleScript(c, names.wezterm),
};

export const useTerminalApp = () => {
  const { data } = useCachedPromise(
    async (terminalApp: TerminalApp) => {
      const apps = await getApplications();
      return apps.some((app) => app.bundleId?.toLowerCase() === appBundleIds[terminalApp].toLowerCase());
    },
    [preferences.terminalApp],
    {
      failureToastOptions: {
        title: "Failed to check if Terminal App is installed",
      },
    },
  );

  return {
    terminalIcon: data ? icons[preferences.terminalApp] : icons.terminal,
    terminalName: data ? names[preferences.terminalApp] : names.terminal,
    runCommandInTerminal: async (command: string) => {
      try {
        const cmd = data ? appleScripts[preferences.terminalApp](command) : appleScripts.terminal(command);
        await runAppleScript(cmd);
        await closeMainWindow();
      } catch (error) {
        showFailureToast(error, { title: "Could not run command in terminal" });
      }
    },
  };
};
