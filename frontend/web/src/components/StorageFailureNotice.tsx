import { useEffect, useState } from "react";
import { useRuntime } from "../runtime/context.tsx";
import { retryStorageWrites } from "../lib/userStorage.ts";
import { useWorkspaceT } from "./library/workspaceMessages.ts";

export function StorageFailureNotice() {
  const { adapter } = useRuntime();
  const t = useWorkspaceT();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const fail = () => setFailed(true), saved = () => setFailed(false);
    window.addEventListener("pcui-storage-error", fail); window.addEventListener("pcui-storage-saved", saved);
    return () => { window.removeEventListener("pcui-storage-error", fail); window.removeEventListener("pcui-storage-saved", saved); };
  }, []);
  if (!adapter.storage || !failed) return null;
  return <aside role="alert" className="notice" style={{ position: "sticky", top: 0, zIndex: 100, margin: "0.5rem 1rem" }}>
    {t("unsaved")} <button className="second-btn" disabled={busy} onClick={() => {
      setBusy(true); void retryStorageWrites().then(() => setFailed(false), () => {}).finally(() => setBusy(false));
    }}>{t("retry")}</button>
  </aside>;
}
