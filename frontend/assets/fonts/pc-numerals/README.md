# PC Numerals

环境详情卡与分享图使用的数字字体，随 UI bundle 自托管（导出图片需要内嵌字体，外部字体源在国内也不稳定）。

- 来源：Saira Semi Condensed（The Saira Project Authors），取自 npm `@fontsource/saira-semi-condensed@5.3.0` 的 latin 子集，字重 500/600/700/800。
- 许可：SIL Open Font License 1.1，全文见 `OFL.txt`。
- 修改：只保留 `0-9 # % + - . , / : – − × ·` 与空格；数字统一为等宽步进（字形居中），供右对齐数值列使用。因为这是修改版，按 OFL 保留字体名条款改名为 “PC Numerals”，不得再以 “Saira” 名义分发。
- CSS 通过 `unicode-range` 只把这些字符交给本字体，其余字符回落到界面字体。

重新生成时用 fontTools 对上述 woff2 做子集化（`flavor=woff2`，保留全部 name 记录），再改写 name 表 1/3/4/6/16 并把 0–9 的 advance 统一为其中最大值。
