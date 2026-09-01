use tauri::{
    AppHandle, Wry,
    menu::{AboutMetadataBuilder, Menu, MenuBuilder, MenuItem},
};

struct Labels {
    new_chat: &'static str,
    open_workspace: &'static str,
    close: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    reload: &'static str,
    reset_zoom: &'static str,
    zoom_in: &'static str,
    zoom_out: &'static str,
    minimize: &'static str,
    show_window: &'static str,
    project_home: &'static str,
    check_updates: &'static str,
    about: &'static str,
}

const ZH: Labels = Labels {
    new_chat: "新建会话",
    open_workspace: "打开工作空间...",
    close: "关闭窗口",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    select_all: "全选",
    reload: "重新加载",
    reset_zoom: "重置缩放",
    zoom_in: "放大",
    zoom_out: "缩小",
    minimize: "最小化",
    show_window: "显示主窗口",
    project_home: "项目主页",
    check_updates: "检查更新",
    about: "关于 DSH Desktop",
};

const EN: Labels = Labels {
    new_chat: "New Chat",
    open_workspace: "Open Workspace...",
    close: "Close Window",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    select_all: "Select All",
    reload: "Reload",
    reset_zoom: "Reset Zoom",
    zoom_in: "Zoom In",
    zoom_out: "Zoom Out",
    minimize: "Minimize",
    show_window: "Show Main Window",
    project_home: "Project Homepage",
    check_updates: "Check for Updates",
    about: "About DSH Desktop",
};

fn labels(chinese: bool) -> &'static Labels {
    if chinese { &ZH } else { &EN }
}

fn new_chat(app: &AppHandle, text: &str) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, "app:new-chat", text, true, Some("CmdOrCtrl+N"))
}

fn open_workspace(app: &AppHandle, text: &str) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, "app:open-workspace", text, true, Some("CmdOrCtrl+O"))
}

pub fn build_popup(app: &AppHandle, label: &str) -> tauri::Result<Option<Menu<Wry>>> {
    let chinese = matches!(label, "文件" | "编辑" | "视图" | "窗口" | "帮助");
    let copy = labels(chinese);
    let menu = match label {
        "文件" | "File" => MenuBuilder::new(app)
            .item(&new_chat(app, copy.new_chat)?)
            .item(&open_workspace(app, copy.open_workspace)?)
            .separator()
            .close_window_with_text(copy.close)
            .build()?,
        "编辑" | "Edit" => MenuBuilder::new(app)
            .undo_with_text(copy.undo)
            .redo_with_text(copy.redo)
            .separator()
            .cut_with_text(copy.cut)
            .copy_with_text(copy.copy)
            .paste_with_text(copy.paste)
            .select_all_with_text(copy.select_all)
            .build()?,
        "视图" | "View" => MenuBuilder::new(app)
            .text("app:reload", copy.reload)
            .separator()
            .text("app:zoom-reset", copy.reset_zoom)
            .text("app:zoom-in", copy.zoom_in)
            .text("app:zoom-out", copy.zoom_out)
            .build()?,
        "窗口" | "Window" => MenuBuilder::new(app)
            .minimize_with_text(copy.minimize)
            .text("app:show", copy.show_window)
            .build()?,
        "帮助" | "Help" => MenuBuilder::new(app)
            .text("app:project-home", copy.project_home)
            .text("app:check-updates", copy.check_updates)
            .separator()
            .about_with_text(
                copy.about,
                Some(
                    AboutMetadataBuilder::new()
                        .name(Some("DSH Desktop"))
                        .version(Some(app.package_info().version.to_string()))
                        .website(Some("https://github.com/FuqiangCraft/dsh-desktop"))
                        .build(),
                ),
            )
            .build()?,
        _ => return Ok(None),
    };
    Ok(Some(menu))
}
