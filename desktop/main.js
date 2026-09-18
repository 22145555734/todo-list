// TodoList 学习计时的桌面外壳。
//
// 这里**没有任何应用逻辑** —— 窗口加载的就是线上站点，代码与数据都还在服务器上。
// 它的价值只是「双击即用」：不用记 IP 和端口，有自己的图标与窗口。
//
// 因此 APP_URL 是写死的：换域名或加 HTTPS 都要重新打包发版。
// 这也是为什么它俩（站点地址 / exe）必须一起改。
const { app, BrowserWindow } = require("electron");

const APP_URL = "http://47.106.200.121:8310/";

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 360, // 站点本身是移动端优先，窄窗口也得能用
    minHeight: 480,
    title: "TodoList 学习计时",
    autoHideMenuBar: true, // 顶栏对这一屏内容没用，按 Alt 才出来
  });
  win.loadURL(APP_URL);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
