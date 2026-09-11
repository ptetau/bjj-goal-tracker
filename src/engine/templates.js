// Starter sets — the coach's sets an empty slot offers. Pure data in the
// exact authoring format the parser reads, every line a step on the ladder
// ("from => to", see ladder.js), shared by the client (offline fallback)
// and the server store (seed + coach-owned truth). Conventions, per the
// spec: tokui sets target the finishes (x25), never the makes and holds;
// growth sets target everything high (x50) — on a growth list, fifty of
// the new thing is the whole point.

export const DEFAULT_TEMPLATES = [
  {
    key: "fundamentals",
    name: "Fundamentals",
    type: "tokui",
    lines: `Both standing => Collar tie
Collar tie => Front headlock
Front headlock => Takedown x25
I'm down => Closed guard
Closed guard => Hold
Closed guard => Armbar x25`,
  },
  {
    key: "front-headlock",
    name: "Front headlock",
    type: "tokui",
    lines: `Both standing => Front headlock
Front headlock => Hold
Front headlock => Rear body lock
Front headlock => Takedown x25
Front headlock => Guillotine x25
Front headlock => Darce x25
Front headlock => Anaconda x25`,
  },
  {
    key: "body-lock",
    name: "Body lock",
    type: "tokui",
    lines: `Both standing => Body lock
Body lock => Hold
Body lock => Rear body lock
Body lock => Takedown x25
Body lock => Takedown => Ko soto gari x25
Body lock => Takedown => Ouchi gari x25
Rear body lock => Back x25`,
  },
  {
    key: "single-leg",
    name: "Single leg",
    type: "tokui",
    lines: `Both standing => Single leg
Single leg => Hold
Single leg => Rear body lock
Single leg => Takedown x25
Single leg => Takedown => Run the pipe x25
Single leg => Back x25`,
  },
  {
    key: "two-on-one",
    name: "Two-on-one",
    type: "tokui",
    lines: `Both standing => Two-on-one
Two-on-one => Hold
Two-on-one => Front headlock
Two-on-one => Rear body lock
Two-on-one => Takedown x25`,
  },
  {
    key: "back-attack",
    name: "Back attack",
    type: "tokui",
    lines: `They're down => Seatbelt
Seatbelt => Hold
Seatbelt => Rear naked strangle x25
Seatbelt => Bow and arrow x25
Seatbelt => Armbar x25`,
  },
  {
    key: "mount-ties",
    name: "Mount ties",
    type: "tokui",
    lines: `They're down => Gift wrap
Gift wrap => Hold
Gift wrap => Back x25
Crowbar => Back x25
Shoulder lever => Back x25
Gift wrap => Armbar x25
Cross face => Collar strangle x25`,
  },
  {
    key: "closed-guard",
    name: "Closed guard",
    type: "tokui",
    lines: `I'm down => Closed guard
Closed guard => Hold
Closed guard => Triangle x25
Closed guard => Armbar x25
Closed guard => Seatbelt
Closed guard => Mount => Hip bump sweep x25
Closed guard => Mount => Flower sweep x25`,
  },
  {
    key: "half-guard",
    name: "Half guard",
    type: "tokui",
    lines: `I'm down => Knee shield
Knee shield => Underhook
Underhook => Hold
Underhook => Seatbelt
Underhook => Mount => Old school sweep x25
Underhook => Side control x25`,
  },
  {
    key: "passing",
    name: "Passing",
    type: "tokui",
    lines: `They're down => Double underhooks
Double underhooks => Hold
Double underhooks => Side control x25
Double underhooks => Mount x25
They're down => Body lock
Body lock => Side control x25`,
  },
  {
    key: "standing",
    name: "Standing game",
    type: "tokui",
    lines: `Both standing => Collar tie
Collar tie => Two-on-one
Collar tie => Front headlock
Front headlock => Takedown x25
Both standing => Single leg
Single leg => Takedown x25`,
  },
  {
    key: "leg-entanglement",
    name: "Leg entanglements",
    type: "growth",
    lines: `I'm down => Inside entanglement x50
Inside entanglement => Hold x50
Inside entanglement => Outside entanglement x50
Outside entanglement => Heel hook x50
Inside entanglement => Heel hook x50
Closed entanglement => Heel hook x50`,
  },
  {
    key: "dlr",
    name: "De la Riva",
    type: "growth",
    lines: `I'm down => DLR hook x50
DLR hook => Hold x50
DLR hook => Seatbelt x50
DLR hook => Single leg x50
DLR hook => Mount x50`,
  },
  {
    key: "rdlr",
    name: "Reverse De la Riva",
    type: "growth",
    lines: `I'm down => RDLR hook x50
RDLR hook => Hold x50
RDLR hook => Seatbelt x50
RDLR hook => Mount x50
RDLR hook => Kneebar x50`,
  },
  {
    key: "collar-sleeve",
    name: "Collar sleeve and lasso",
    type: "growth",
    lines: `I'm down => Collar and sleeve x50
Collar and sleeve => Lasso x50
Collar and sleeve => Triangle hub x50
Lasso => Omoplata x50
Triangle hub => Triangle x50`,
  },
  {
    key: "butterfly-k",
    name: "Butterfly and K guard",
    type: "growth",
    lines: `I'm down => Butterfly hooks x50
Butterfly hooks => Hold x50
Butterfly hooks => Mount x50
Butterfly hooks => Inside entanglement x50
K guard => Inside entanglement x50
K guard => Back x50`,
  },
  {
    key: "triangle-hub",
    name: "Triangle hub",
    type: "growth",
    lines: `Closed guard => Triangle hub x50
Triangle hub => Hold x50
Triangle hub => Triangle x50
Triangle hub => Armbar x50
Triangle hub => Omoplata hub x50
Omoplata hub => Omoplata x50`,
  },
];
