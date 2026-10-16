/** Local workspace persistence. Opaque library rows survive future schema versions. */
import { z } from "zod";

export const WorkspaceInfoDtoSchema = z.object({
  path: z.string().min(1), workspaceId: z.string().min(1),
  libraryPath: z.string().min(1), recordsPath: z.string().min(1), sessionsPath: z.string().min(1),
});
export type WorkspaceInfoDto = z.infer<typeof WorkspaceInfoDtoSchema>;
export const WorkspacePickerRequestDtoSchema = z.object({ workspaceId: z.string().min(1), lang: z.enum(["zh", "en", "ja"]) });
export const WorkspacePickerResultDtoSchema = z.object({ path: z.string().min(1).nullable() });
export const WorkspaceLibraryDtoSchema = z.object({
  workspaceId: z.string().min(1), revision: z.string().min(1),
  teams: z.array(z.unknown()), box: z.array(z.unknown()), layout: z.unknown(),
});
export type WorkspaceLibraryDto = z.infer<typeof WorkspaceLibraryDtoSchema>;
export const WorkspaceBrowserImportDtoSchema = WorkspaceLibraryDtoSchema.extend({ records: z.array(z.unknown()) });
export const WorkspaceSwitchRequestDtoSchema = z.object({
  path: z.string().min(1).max(4096), migrate: z.boolean(), workspaceId: z.string().min(1),
});
export const WorkspaceRecordsDtoSchema = z.object({
  workspaceId: z.string().min(1), records: z.array(z.unknown()),
});
export const WorkspaceRecordWriteDtoSchema = z.object({ workspaceId: z.string().min(1), record: z.record(z.string(), z.unknown()) });
export const WorkspaceRecordDeleteDtoSchema = z.object({ workspaceId: z.string().min(1), ids: z.array(z.string().min(1)).max(1000) });
