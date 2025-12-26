// Shell 检测和配置
use portable_pty::CommandBuilder;

/// Shell Integration 脚本（通过 PTY 注入）
/// 使用空格前缀让命令不进入历史记录，使用重定向隐藏输出
/// 注意：bash/zsh 默认配置下，以空格开头的命令不会记录到历史

// Bash: 定义函数并设置 PROMPT_COMMAND，静默执行
const SHELL_INTEGRATION_BASH: &str = " eval '__sw_cwd(){ printf \"\\e]7;file://%s%s\\e\\\\\" \"${HOSTNAME:-localhost}\" \"$PWD\";};PROMPT_COMMAND=\"__sw_cwd${PROMPT_COMMAND:+;$PROMPT_COMMAND}\"' 2>/dev/null;__sw_cwd;printf '\\ec'\n";

// Zsh: 使用 precmd hook，静默执行
const SHELL_INTEGRATION_ZSH: &str = " eval '__sw_cwd(){ printf \"\\e]7;file://%s%s\\e\\\\\" \"${HOST:-localhost}\" \"$PWD\";};autoload -Uz add-zsh-hook;add-zsh-hook precmd __sw_cwd;add-zsh-hook chpwd __sw_cwd' 2>/dev/null;__sw_cwd;printf '\\ec'\n";

// Fish: 使用事件监听
const SHELL_INTEGRATION_FISH: &str = " eval 'function __sw_cwd --on-variable PWD; printf \"\\e]7;file://%s%s\\e\\\\\" (hostname) $PWD; end' 2>/dev/null;__sw_cwd;printf '\\ec'\n";

// PowerShell: 重写 prompt 函数
const SHELL_INTEGRATION_PWSH: &str = " $null = Invoke-Expression 'if(-not $env:__sw_i){$env:__sw_i=1;function __sw_cwd{Write-Host -NoNewline \"`e]9;9;$($PWD.Path)`e\\\"};$__sw_op=$function:prompt;function global:prompt{__sw_cwd;if($__sw_op){&$__sw_op}else{\"PS $PWD> \"}}}';__sw_cwd;Clear-Host\n";

// CMD: 使用 DOSKEY 宏拦截 cd 命令，并设置自定义 PROMPT
// 注意：CMD 的 OSC 支持有限，使用 OSC 9;9 格式（Windows Terminal 支持）
// $p 是当前路径，$e 是 ESC 字符
const SHELL_INTEGRATION_CMD: &str = "@echo off & doskey cd=cd $* ^& echo $e]9;9;%CD%$e\\ & prompt $e]9;9;$p$e\\$p$g & cls\n";

/// 获取 shell integration 脚本
pub fn get_shell_integration_script(shell_type: &str) -> Option<&'static str> {
    match shell_type {
        "bash" | "gitbash" => Some(SHELL_INTEGRATION_BASH),
        "zsh" => Some(SHELL_INTEGRATION_ZSH),
        "fish" => Some(SHELL_INTEGRATION_FISH),
        "pwsh" | "powershell" => Some(SHELL_INTEGRATION_PWSH),
        "cmd" => Some(SHELL_INTEGRATION_CMD),
        _ => None,
    }
}

/// 根据 shell 类型获取 Shell 命令
pub fn get_shell_by_type(shell_type: Option<&str>) -> CommandBuilder {
    match shell_type {
        Some("cmd") => CommandBuilder::new("cmd.exe"),
        Some("powershell") => {
            #[cfg(windows)]
            {
                // 优先使用 PowerShell Core (pwsh)，回退到 Windows PowerShell
                if let Ok(pwsh_path) = which_powershell() {
                    CommandBuilder::new(pwsh_path)
                } else {
                    CommandBuilder::new("powershell.exe")
                }
            }
            #[cfg(not(windows))]
            {
                // 非 Windows 平台，使用默认 shell
                get_default_shell()
            }
        }
        Some("wsl") => CommandBuilder::new("wsl.exe"),
        Some("gitbash") => {
            #[cfg(windows)]
            {
                // Git Bash: 尝试查找常见安装路径
                if let Ok(bash_path) = which_gitbash() {
                    let mut cmd = CommandBuilder::new(bash_path);
                    // 添加 --login 参数以加载用户配置
                    cmd.arg("--login");
                    cmd
                } else {
                    // 回退到默认 shell
                    get_default_shell()
                }
            }
            #[cfg(not(windows))]
            {
                // 非 Windows 平台，使用 bash
                CommandBuilder::new("bash")
            }
        }
        Some("bash") => CommandBuilder::new("bash"),
        Some("zsh") => CommandBuilder::new("zsh"),
        Some(custom) if custom.starts_with("custom:") => {
            // 自定义 shell 路径，格式: "custom:/path/to/shell"
            let path = &custom[7..]; // 去掉 "custom:" 前缀
            CommandBuilder::new(path)
        }
        _ => get_default_shell(), // None 或未知类型，使用默认
    }
}

/// 获取默认 Shell 命令
pub fn get_default_shell() -> CommandBuilder {
    #[cfg(windows)]
    {
        // Windows: 默认使用 CMD
        CommandBuilder::new("cmd.exe")
    }

    #[cfg(not(windows))]
    {
        // Unix: 从环境变量获取 SHELL，回退到 /bin/bash
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    }
}

#[cfg(windows)]
fn which_powershell() -> Result<String, ()> {
    // 尝试查找 PowerShell
    let powershell_paths = vec![
        "pwsh.exe",           // PowerShell Core
        "powershell.exe",     // Windows PowerShell
    ];

    for path in powershell_paths {
        if std::process::Command::new(path)
            .arg("-Command")
            .arg("exit")
            .output()
            .is_ok()
        {
            return Ok(path.to_string());
        }
    }

    Err(())
}

#[cfg(windows)]
fn which_gitbash() -> Result<String, ()> {
    // Git Bash 常见安装路径
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let gitbash_paths = vec![
        "C:\\Program Files\\Git\\bin\\bash.exe".to_string(),
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe".to_string(),
        format!("{}\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", userprofile),
    ];

    // 检查路径是否存在
    for path in gitbash_paths {
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
    }

    // 尝试从 PATH 环境变量查找
    if let Ok(output) = std::process::Command::new("where")
        .arg("bash.exe")
        .output()
    {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                // 获取第一行路径
                if let Some(first_line) = stdout.lines().next() {
                    let path = first_line.trim();
                    // 确保是 Git 安装的 bash
                    if path.contains("Git") {
                        return Ok(path.to_string());
                    }
                }
            }
        }
    }

    Err(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_default_shell() {
        // 只测试函数能够成功返回，不检查具体内容
        // 因为 CommandBuilder 不提供获取程序路径的公共 API
        let _shell = get_default_shell();
        // 如果能执行到这里，说明函数正常工作
    }
}
