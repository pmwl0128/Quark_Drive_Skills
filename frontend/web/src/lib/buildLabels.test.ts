import type { NatureDto } from "@pokemon-champions/protocol";
import { expect, it } from "vitest";
import { natureOrder } from "./buildLabels.ts";

it("groups remaining natures in table order, putting all neutral natures last", () => {
  const rows: NatureDto[] = [
    { name: "Serious", upStat: null, downStat: null },
    { name: "Timid", upStat: "spe", downStat: "atk" },
    { name: "Quiet", upStat: "spa", downStat: "spe" },
    { name: "Hardy", upStat: "atk", downStat: "atk" },
    { name: "Brave", upStat: "atk", downStat: "spe" },
    { name: "Bashful", upStat: null, downStat: null },
    { name: "Bold", upStat: "def", downStat: "atk" },
    { name: "Modest", upStat: "spa", downStat: "atk" },
    { name: "Docile", upStat: null, downStat: null },
    { name: "Adamant", upStat: "atk", downStat: "spa" },
    { name: "Calm", upStat: "spd", downStat: "atk" },
    { name: "Lonely", upStat: "atk", downStat: "def" },
    { name: "Quirky", upStat: null, downStat: null },
  ];
  expect([...rows].sort(natureOrder).map((nature) => nature.name)).toEqual([
    "Lonely", "Adamant", "Brave", "Bold", "Modest", "Quiet", "Calm", "Timid",
    "Hardy", "Docile", "Bashful", "Quirky", "Serious",
  ]);
});
