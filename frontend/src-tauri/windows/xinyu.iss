; ============================================================
; 心愈 XinYu 0.1.8 —— Inno Setup 7 安装包脚本
; 用户级安装（与原 NSIS currentUser 模式一致）
; 打包命令: ISCC.exe D:\AIHeartHealProject\frontend\src-tauri\windows\xinyu.iss
; ============================================================

#define MyAppName "心愈"
#define MyAppNameEn "XinYu"
#define MyAppVersion "0.1.8"
#define MyAppPublisher "XinYu"
#define MyAppExeName "心愈.exe"
#define MyAppRoot "D:\AIHeartHealProject\frontend\src-tauri"

[Setup]
AppId={{9E1F4C7A-52B8-4E63-9A1D-30C2F5B8D6E1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppNameEn}
DisableProgramGroupPage=yes
OutputDir={#MyAppRoot}\target\release\bundle\inno
OutputBaseFilename=心愈_{#MyAppVersion}_x64-setup
SetupIconFile={#MyAppRoot}\icons\icon.ico
UninstallDisplayIcon={app}\xinyu.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "chs"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Files]
; 应用本体（Tauri 构建产物，前端资源已内嵌）
Source: "{#MyAppRoot}\target\release\xinyu-app.exe"; DestName: "{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; 独立图标文件：快捷方式指向它而非 exe（Windows 图标缓存按路径缓存，独立文件可避免覆盖安装后快捷方式图标不刷新）
Source: "{#MyAppRoot}\icons\icon.ico"; DestName: "xinyu.ico"; DestDir: "{app}"; Flags: ignoreversion
; 通知图标：Toast 通知的 IconUri 仅支持 PNG（不支持 .ico，否则显示黑色方块）
Source: "{#MyAppRoot}\icons\128x128.png"; DestName: "notification.png"; DestDir: "{app}"; Flags: ignoreversion
; WebView2 引导器（缺失运行时时装入临时目录执行）
Source: "{#MyAppRoot}\windows\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: dontcopy noencryption

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\xinyu.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\xinyu.ico"; Tasks: desktopicon

; 注册 AUMID：系统通知横幅显示「心愈」名称与应用图标（Tauri 通知插件以 identifier 作为 AUMID）
[Registry]
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\com.xinyu.heart"; ValueType: string; ValueName: "DisplayName"; ValueData: "心愈"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\com.xinyu.heart"; ValueType: string; ValueName: "IconUri"; ValueData: "{app}\notification.png"; Flags: uninsdeletekey

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Code]
const
  // WebView2 Evergreen Runtime 的 EdgeUpdate 客户端 GUID
  WV2_GUID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function IsWebView2Installed: Boolean;
var
  pv: String;
begin
  Result := False;
  if RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\' + WV2_GUID, 'pv', pv) or
     RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_GUID, 'pv', pv) or
     RegQueryStringValue(HKEY_CURRENT_USER, 'Software\Microsoft\EdgeUpdate\Clients\' + WV2_GUID, 'pv', pv) then
    Result := (pv <> '') and (pv <> '0.0.0.0');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  if not IsWebView2Installed then
  begin
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
    if Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/install /silent /norestart', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
    begin
      if not IsWebView2Installed then
        Result := 'WebView2 运行时安装未完成（需要联网），请检查网络后重新运行安装程序。';
    end
    else
      Result := 'WebView2 运行时安装器启动失败，请手动访问 https://developer.microsoft.com/microsoft-edge/webview2/ 安装。';
  end;
end;
