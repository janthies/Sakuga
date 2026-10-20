// Late-bound calls: a lower layer reaches a higher one through this table, which the higher module fills at load.
// This keeps the import graph free of cycles and keeps render, tools and commands independent of panels.
export const calls: Record<string, any> = {};
