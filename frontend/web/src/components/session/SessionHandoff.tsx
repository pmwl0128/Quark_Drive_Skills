import type { SessionDto } from "@pokemon-champions/protocol";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { defineMessages } from "../../i18n.ts";
import { useToast } from "../Toast.tsx";
import "./session-handoff.css";

const useHandoffT = defineMessages({
  title: { zh: "交给你的 AI 助手", en: "Hand off to your AI assistant", ja: "AIアシスタントに引き継ぐ" },
  body: { zh: "复制下面的说明，发送给安装了 Quark Drive Skills 的助手。此页面会接收它提交的进展与结果。", en: "Copy this instruction to an assistant with Quark Drive Skills installed. Its submitted progress and results appear here.", ja: "以下の指示をコピーして、Quark Drive Skillsを導入したアシスタントに送信してください。送られた進捗と結果がここに表示されます。" },
  instruction: { zh: "处理 Quark Drive 本地会话 {id}。先读取该会话的需求、赛制、附带队伍及已有产物和决策，再按完整 UEP 流程处理，将各阶段进展与最终结果写回这个会话。", en: "Work on Quark Drive local session {id}. Read its request, format, attached team, existing artifacts and decisions. Follow the full UEP workflow and submit each stage and the final result to this session.", ja: "Quark Driveのローカルセッション {id} を処理してください。依頼・形式・添付チーム・既存の成果物と判断を読み、完全なUEP手順に沿って各段階の進捗と最終結果をこのセッションに提出してください。" },
  copy: { zh: "复制交接说明", en: "Copy handoff", ja: "引き継ぎ指示をコピー" },
  copied: { zh: "已复制", en: "Copied", ja: "コピーしました" },
  failed: { zh: "复制失败，请选中说明文字手动复制。", en: "Could not copy. Select the instruction and copy it manually.", ja: "コピーできませんでした。指示文を選択して手動でコピーしてください。" },
});

export function SessionHandoff({ session }: { session: SessionDto }) {
  const t = useHandoffT();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const instruction = t("instruction").replace("{id}", session.id);
  return <section className="session-handoff">
    <div><h2>{t("title")}</h2><p>{t("body")}</p></div>
    <div className="session-handoff-instruction"><p>{instruction}</p>
      <button type="button" className="second-btn" onClick={async () => {
        try { await navigator.clipboard.writeText(instruction); setCopied(true); }
        catch { toast({ text: t("failed") }); }
      }}>{copied ? <IconCheck size={16} aria-hidden /> : <IconCopy size={16} aria-hidden />}{t(copied ? "copied" : "copy")}</button></div>
  </section>;
}
