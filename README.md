# 無人機普通操作證模擬測驗

離線題庫 App，題目來源為民航局「遙控無人機普通操作證學科測驗題庫」PDF。

## 考試規格

- 普通操作證學科測驗：20 題
- 測驗時間：30 分鐘
- 題型：4 選 1 單選題
- 計分：答錯不倒扣，滿分 100 分，80 分及格
- 考科：民用航空法及相關法規、基礎飛行原理、氣象、緊急處置與飛行決策

## 本機預覽

```powershell
npm run serve
```

開啟 `http://127.0.0.1:4175/index.html`。

## GitHub Pages 部署

這個專案已經可以直接部署到 GitHub Pages。把專案推到 GitHub 後：

1. 到 repo 的 `Settings` -> `Pages`
2. `Source` 選 `GitHub Actions`
3. push 到 `main`，或到 `Actions` 手動執行 `Deploy GitHub Pages`

發布內容來自 `web/`，所以不需要後端伺服器。

## 產生 APK

需要先安裝 Android Studio 或 Android SDK，並讓 `gradle` 可在命令列執行。

```powershell
npm run apk
```

Debug APK 會在 `app/build/outputs/apk/debug/app-debug.apk`。

## 官方來源

- 交通部民用航空局：遙控無人機學科測驗題庫
  https://www.caa.gov.tw/Article.aspx?a=3833
- 交通部民用航空局：遙控無人機學科測驗規範
  https://www.caa.gov.tw/Article.aspx?a=3832&lang=1
