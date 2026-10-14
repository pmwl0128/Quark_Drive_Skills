# QD Display

首页展示标题（开屏字标、区块标题、安装区标题）里的拉丁字母字体，随 UI bundle 自托管。

- 来源：Saira（The Saira Project Authors），取自 npm `@fontsource/saira@5.3.0` 的 latin 子集，字重 600/800。
- 许可：SIL Open Font License 1.1，全文见 `OFL.txt`。
- 修改：只保留 U+0020–007E、U+00C0–00FF、U+2011（不换行连字符）与 U+2019；作为修改版改名为 “QD Display”，不再以 “Saira” 名义分发。
- CSS 通过 `unicode-range` 只把这些字符交给本字体，中日文回落到界面字体。

重新生成时用 fontTools 对上述 woff2 做子集化（`flavor=woff2`，保留全部 name 记录，保留 `kern`/`liga`/`calt`），再改写 name 表 1/3/4/6/16/17。
