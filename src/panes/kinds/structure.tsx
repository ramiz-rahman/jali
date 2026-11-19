import { TreeViewIcon } from "@phosphor-icons/react";
import { definePane } from "@jali/react";
import type { TableName } from "../../data/types";
import { useCatalog } from "../../data/hooks";
import { formatCount } from "../format";
import { erRef, tableInfoOf, tableRef } from "../shared/refs";
import { NullChip, Shell } from "../shared/states";
import { PaneGate } from "../shared/PaneGate";
import type { PaneProps } from "@jali/react";

export function StructurePane({ params, paused, openBeside }: PaneProps<{ table: string }>) {
  const table = params.table as TableName;
  const cat = useCatalog({ paused });
  const info = tableInfoOf(cat.data, table);
  if (!info || cat.isError)
    return <PaneGate queries={[cat]} gone={!info ? `Table "${table}"` : undefined} />;
  return (
    <Shell>
      <div className="pk-bar">
        <div className="grow">
          <div style={{ fontWeight: 500, fontSize: 14 }}>{info.name}</div>
          <div className="pk-meta">
            <span className="pk-mono">{formatCount(info.rowCount)}</span> rows ·{" "}
            {info.columns.length} columns
          </div>
        </div>
        <button className="pk-btn" onClick={() => openBeside(tableRef(table))}>
          Rows
        </button>
        <button className="pk-btn" onClick={() => openBeside(erRef(table))}>
          Relations
        </button>
      </div>
      <div className="pk-rec">
        <div role="table" aria-label={`${table} columns`}>
          <div
            role="row"
            className="pk-field pk-meta"
            style={{ gridTemplateColumns: "1.2fr 1fr 70px" }}
          >
            <span role="columnheader">Column</span>
            <span role="columnheader">Type</span>
            <span role="columnheader">Keys</span>
          </div>
          {info.columns.map((c) => (
            <div
              role="row"
              className="pk-field"
              key={c.name}
              style={{ gridTemplateColumns: "1.2fr 1fr 70px" }}
            >
              <span role="cell">{c.name}</span>
              <span role="cell" className="pk-mono pk-meta">
                {c.type.toLowerCase()}
                {c.nullable ? "" : " · not null"}
              </span>
              <span role="cell" style={{ display: "flex", gap: 4 }}>
                {c.primaryKey && <span className="pk-chip key">PK</span>}
                {c.references && <span className="pk-chip key">FK</span>}
                {!c.primaryKey && !c.references && c.nullable && <NullChip />}
              </span>
              {c.references && (
                <span style={{ gridColumn: "1 / -1" }} className="pk-meta">
                  references{" "}
                  <button
                    className="pk-link"
                    onClick={() =>
                      openBeside({ kind: "structure", params: { table: c.references!.table } })
                    }
                  >
                    {c.references.table}.{c.references.column}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        {info.referencedBy.length > 0 && (
          <>
            <div className="pk-sec">Referenced by</div>
            {info.referencedBy.map((r) => (
              <div className="pk-field" key={r.table + r.column}>
                <button
                  className="pk-link"
                  style={{ textAlign: "left" }}
                  onClick={() => openBeside({ kind: "structure", params: { table: r.table } })}
                >
                  {r.table}
                </button>
                <span className="pk-mono pk-meta">{r.column}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </Shell>
  );
}

export const structureKind = definePane("structure", {
  params: { table: String },
  title: ({ table }) => `${table} structure`,
  icon: TreeViewIcon,
  width: { min: 380, comfortable: 440, max: 720 },
  height: { min: 240 },
  Component: StructurePane,
});
