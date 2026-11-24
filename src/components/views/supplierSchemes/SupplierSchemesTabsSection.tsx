import React from 'react';
import { CheckCircle2, ExternalLink, FilePlus2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { MonthlyIncentiveRow, SupplierCreditNote, SupplierScheme } from '../../../types';
import { isClaimLinkedNote } from '../../../utils/supplierSchemes';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui';
import { InfoTip } from '../../common/InfoTip';
import { CnFilter, inr, Stat, TabKey, typeShort } from './supplierSchemesShared';

interface SupplierSchemesTabsSectionProps {
  tab: TabKey;
  cnFilter: CnFilter;
  setCnFilter: React.Dispatch<React.SetStateAction<CnFilter>>;
  supplierSchemes: SupplierScheme[];
  supplierCreditNotes: SupplierCreditNote[];
  schemeNotes: SupplierCreditNote[];
  claimNotes: SupplierCreditNote[];
  visibleNotes: SupplierCreditNote[];
  schemeById: Map<string, SupplierScheme>;
  usageByScheme: Map<string, { lines: number; freeCases: number; expected: number }>;
  monthlyReport: MonthlyIncentiveRow[];
  openCreate: () => void;
  openEdit: (s: SupplierScheme) => void;
  openReceipt: (n: SupplierCreditNote) => void;
  openEditNote: (n: SupplierCreditNote) => void;
  openClaim: () => void;
  raiseMonthlyNote: (r: MonthlyIncentiveRow) => void;
  noteForRow: (r: MonthlyIncentiveRow) => SupplierCreditNote | undefined;
  statusBadge: (status: string) => React.ReactNode;
  productNames: (ids: number[]) => string;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<{ id: string; name: string; used: number } | null>>;
  setDeleteNoteConfirm: React.Dispatch<React.SetStateAction<SupplierCreditNote | null>>;
  updateSupplierScheme: (id: string, updates: Partial<SupplierScheme>) => void;
  updateSupplierCreditNote: (id: string, updates: Partial<SupplierCreditNote>) => void;
}

export const SupplierSchemesTabsSection: React.FC<SupplierSchemesTabsSectionProps> = ({
  tab,
  cnFilter,
  setCnFilter,
  supplierSchemes,
  supplierCreditNotes,
  schemeNotes,
  claimNotes,
  visibleNotes,
  schemeById,
  usageByScheme,
  monthlyReport,
  openCreate,
  openEdit,
  openReceipt,
  openEditNote,
  openClaim,
  raiseMonthlyNote,
  noteForRow,
  statusBadge,
  productNames,
  setDeleteConfirm,
  setDeleteNoteConfirm,
  updateSupplierScheme,
  updateSupplierCreditNote,
}) => {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* SCHEMES                                                            */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'schemes' && (
        <>
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold text-slate-800">Supplier schemes</h3>
            <InfoTip title="Schemes" size="sm">
              <p>
                A scheme is a standing supplier offer. Create it once here, then use it:
              </p>
              <ul>
                <li>
                  <strong>Type A / B</strong> appear in the “Supplier scheme” dropdown on every GRN line (Inventory → Add
                  stock). Only <strong>Active</strong> schemes are offered there.
                </li>
                <li>
                  <strong>Type C</strong> is not attached to a GRN. It reads your posted bills for the selected products
                  each month (cancelled bills are ignored and customer returns are deducted).
                </li>
              </ul>
              <p>
                Tap the Active / Inactive badge to switch a scheme off without deleting it. Deleting a scheme keeps all
                quantities and credit notes already recorded against it.
              </p>
            </InfoTip>
          </div>

          {supplierSchemes.length === 0 ? (
            <Card>
              <CardContent className="text-center text-sm text-slate-500 py-8 space-y-3">
                <p>No supplier schemes yet.</p>
                <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate} className="h-10">
                  Create your first scheme
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <Card noPadding className="hidden lg:block overflow-hidden">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierSchemes.map((s) => {
                      const u = usageByScheme.get(s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-slate-900 min-w-[150px]">{s.name}</TableCell>
                          <TableCell className="min-w-[130px]">{s.supplierName}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{typeShort(s.schemeType)}</TableCell>
                          <TableCell className="text-xs min-w-[180px] max-w-[260px]">{productNames(s.productIds)}</TableCell>
                          <TableCell className="text-xs tabular-nums min-w-[140px]">
                            {s.schemeType === 'volume_incentive'
                              ? `${(s.targetQuantity || 0).toLocaleString('en-IN')} cs · ${inr(s.incentiveRate || 0)}/cs`
                              : u
                              ? `${u.lines} GRN line${u.lines > 1 ? 's' : ''}${u.freeCases ? ` · ${u.freeCases} free cs` : ''}${
                                  u.expected ? ` · ${inr(u.expected)}` : ''
                                }`
                              : 'Not used yet'}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap tabular-nums">
                            {s.startDate} {s.endDate ? `→ ${s.endDate}` : '(open)'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => updateSupplierScheme(s.id, { active: !s.active })}
                              title="Tap to switch on / off"
                              className="cursor-pointer"
                            >
                              <Badge variant={s.active ? 'success' : 'neutral'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="inline-flex justify-end gap-1.5">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(s)} aria-label="Edit scheme">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Delete scheme"
                                onClick={() => setDeleteConfirm({ id: s.id, name: s.name, used: u?.lines || 0 })}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Phone (1-col) & Tablet (2-col) cards */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3.5">
                {supplierSchemes.map((s) => {
                  const u = usageByScheme.get(s.id);
                  return (
                    <div
                      key={s.id}
                      data-card-tone={s.active ? 'profit' : 'neutral'}
                      className="rounded-2xl border shadow-xs p-3.5 md:p-4 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 break-words">{s.name}</p>
                          <p className="text-xs text-slate-600 break-words leading-snug mt-0.5">{s.supplierName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateSupplierScheme(s.id, { active: !s.active })}
                          aria-label={s.active ? 'Switch scheme off' : 'Switch scheme on'}
                          className="shrink-0 cursor-pointer"
                        >
                          <Badge variant={s.active ? 'success' : 'neutral'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5">
                        <Badge variant="accent">{typeShort(s.schemeType)}</Badge>
                        <span className="text-xs text-slate-500">
                          {s.startDate} {s.endDate ? `→ ${s.endDate}` : '→ open'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 break-words">{productNames(s.productIds)}</p>

                      <div className="mt-2.5 text-xs rounded-xl bg-white/80 border border-black/5 px-2.5 py-1.5 text-slate-600">
                        {s.schemeType === 'volume_incentive' ? (
                          <>
                            Target <strong className="text-slate-800">{(s.targetQuantity || 0).toLocaleString('en-IN')} cs</strong>/month ·{' '}
                            <strong className="text-slate-800">{inr(s.incentiveRate || 0)}</strong>/cs ·{' '}
                            {s.calculationMethod === 'excess_only' ? 'excess cases only' : 'all cases'}
                          </>
                        ) : u ? (
                          <>
                            Used on <strong className="text-slate-800">{u.lines}</strong> GRN line{u.lines > 1 ? 's' : ''}
                            {u.freeCases > 0 && (
                              <>
                                {' '}· <strong className="text-slate-800">{u.freeCases}</strong> free cs
                              </>
                            )}
                            {u.expected > 0 && (
                              <>
                                {' '}· <strong className="text-slate-800">{inr(u.expected)}</strong> expected
                              </>
                            )}
                          </>
                        ) : (
                          'Not used on any GRN yet'
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                        <Button size="sm" variant="outline" className="h-10" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => openEdit(s)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 text-rose-600 border-rose-200"
                          leftIcon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setDeleteConfirm({ id: s.id, name: s.name, used: u?.lines || 0 })}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CREDIT NOTES                                                       */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'credit_notes' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">Supplier credit notes</h3>
              <InfoTip title="Supplier credit notes" size="sm">
                <p>
                  Every ₹ a supplier owes you as a credit note, in one list. <strong>Expected</strong> is what was promised
                  and never changes after you record receipts; <strong>Received</strong> is what the supplier has actually
                  credited; <strong>Outstanding</strong> is the difference.
                </p>
                <ul>
                  <li>
                    <strong>Scheme / incentive</strong> notes come from Type B GRN lines (created automatically when you post
                    the GRN) and from Type C monthly incentives (raise them in the Monthly tab). Record receipts here.
                  </li>
                  <li>
                    <strong>Claim</strong> notes come from Returns &amp; Disposals (expired / damaged / returned stock). They
                    are the <em>same</em> credit notes you record in Inventory → Returns &amp; Disposals, shown here for
                    reference. Edit them there, where the GST split and partial receipts are kept. They are not counted in
                    the totals above, because claims are tracked on the Home screen separately.
                  </li>
                </ul>
                <p>Scheme credits actually received are included in the Supplier credits line of the profit report.</p>
              </InfoTip>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0" role="group" aria-label="Filter credit notes">
            {([
              ['all', `All (${supplierCreditNotes.length})`],
              ['scheme', `Scheme & incentive (${schemeNotes.length})`],
              ['claims', `Claims (${claimNotes.length})`],
            ] as [CnFilter, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setCnFilter(k)}
                className={`h-9 px-3.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  cnFilter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleNotes.length === 0 ? (
            <Card>
              <CardContent className="text-center text-sm text-slate-500 py-8">
                {supplierCreditNotes.length === 0
                  ? 'No supplier credit notes yet. They appear when a GRN line uses a Type B scheme, when you raise a monthly incentive, or when an expiry/damage claim is settled.'
                  : 'Nothing in this filter.'}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <Card noPadding className="hidden lg:block overflow-hidden">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>CN no.</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleNotes.map((n) => {
                      const claim = isClaimLinkedNote(n);
                      const scheme = n.schemeId ? schemeById.get(n.schemeId) : undefined;
                      const outstanding = Math.max(0, n.expectedAmount - n.actualAmount);
                      return (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium text-slate-900 min-w-[150px]">{n.supplierName}</TableCell>
                          <TableCell className="text-xs text-slate-600 min-w-[140px]">
                            {claim ? 'Expiry / damage claim' : scheme?.name || (n.period ? `Incentive ${n.period}` : n.grnId || '—')}
                            {!claim && n.period && scheme ? ` · ${n.period}` : ''}
                          </TableCell>
                          <TableCell className="text-xs font-mono whitespace-nowrap text-slate-700">{n.creditNoteNumber || '—'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">{inr(n.expectedAmount)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums font-medium text-emerald-700">{inr(n.actualAmount)}</TableCell>
                          <TableCell className={`text-right whitespace-nowrap tabular-nums font-semibold ${outstanding > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {inr(outstanding)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{statusBadge(n.status)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="inline-flex justify-end gap-1.5">
                              {claim ? (
                                <Button size="sm" variant="outline" className="whitespace-nowrap" leftIcon={<ExternalLink className="w-3.5 h-3.5" />} onClick={openClaim}>
                                  Open claim
                                </Button>
                              ) : (
                                <>
                                  {n.status !== 'settled' && (
                                    <Button size="sm" variant="outline" className="whitespace-nowrap" leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => openReceipt(n)}>
                                      Record receipt
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => openEditNote(n)} aria-label="Edit credit note">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setDeleteNoteConfirm(n)} aria-label="Delete credit note">
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Phone (1-col) & Tablet (2-col) cards */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3.5">
                {visibleNotes.map((n) => {
                  const claim = isClaimLinkedNote(n);
                  const scheme = n.schemeId ? schemeById.get(n.schemeId) : undefined;
                  const outstanding = Math.max(0, n.expectedAmount - n.actualAmount);
                  const source = claim
                    ? 'Expiry / damage claim'
                    : scheme
                    ? `${scheme.name}${n.period ? ` · ${n.period}` : ''}`
                    : n.period
                    ? `Incentive ${n.period}`
                    : n.grnId
                    ? `GRN ${n.grnId}`
                    : 'Credit note';
                  const cnTone =
                    n.status === 'settled' ? 'received' : outstanding > 0 ? 'warning' : 'sales';
                  return (
                    <div
                      key={n.id}
                      data-card-tone={cnTone}
                      className="rounded-2xl border shadow-xs p-3.5 md:p-4 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words leading-snug">{n.supplierName}</p>
                          <p className="text-xs text-slate-500 break-words mt-0.5">{source}</p>
                          {n.creditNoteNumber && (
                            <p className="text-xs text-slate-500 font-mono mt-0.5">CN {n.creditNoteNumber}</p>
                          )}
                        </div>
                        {statusBadge(n.status)}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <Stat label="Expected" value={inr(n.expectedAmount)} />
                        <Stat label="Received" value={inr(n.actualAmount)} tone="good" />
                        <Stat label="Outstanding" value={inr(outstanding)} tone={outstanding > 0 ? 'warn' : 'default'} />
                      </div>
                      <div className={`grid gap-2 mt-3 pt-3 border-t border-slate-100 ${claim ? 'grid-cols-1' : n.status !== 'settled' ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto]'}`}>
                        {claim ? (
                          <Button size="sm" variant="outline" className="h-10" leftIcon={<ExternalLink className="w-4 h-4" />} onClick={openClaim}>
                            Open claim in Returns &amp; Disposals
                          </Button>
                        ) : (
                          <>
                            {n.status !== 'settled' ? (
                              <Button size="sm" variant="outline" className="h-10" leftIcon={<CheckCircle2 className="w-4 h-4" />} onClick={() => openReceipt(n)}>
                                Record receipt
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-10" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => openEditNote(n)}>
                                Edit
                              </Button>
                            )}
                            {n.status !== 'settled' && (
                              <Button size="sm" variant="outline" className="h-10 w-10 px-0" onClick={() => openEditNote(n)} aria-label="Edit credit note">
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 w-10 px-0 text-rose-600 border-rose-200"
                              onClick={() => setDeleteNoteConfirm(n)}
                              aria-label="Delete credit note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MONTHLY                                                            */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'monthly_report' && (
        <>
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold text-slate-800">Monthly volume incentive</h3>
            <InfoTip title="Monthly volume incentive" size="sm">
              <p>
                One line per Type C scheme per month, for this month and the two before. The target applies to the
                <strong> whole product group together</strong> (not each product on its own).
              </p>
              <ul>
                <li>
                  <strong>Sold</strong> is counted live from your posted bills. Cancelled bills are ignored and customer
                  returns are deducted, so it always matches your sales.
                </li>
                <li>
                  <strong>All cases</strong> pays the rate on every case once the target is hit.{' '}
                  <strong>Excess only</strong> pays the rate only on cases above the target.
                </li>
                <li>
                  When the target is met, tap <strong>Raise credit note</strong> to start tracking what the supplier owes.
                  When the supplier issues the credit note, tap <strong>Record receipt</strong>.
                </li>
              </ul>
              <p>If sales change after you raised the note (a late bill or return), you will see an “Update expected” prompt.</p>
            </InfoTip>
          </div>

          {monthlyReport.length === 0 ? (
            <Card>
              <CardContent className="text-center text-sm text-slate-500 py-8">
                No monthly volume-incentive schemes yet. Create a Type C scheme to see it here.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop table */}
              <Card noPadding className="hidden lg:block overflow-hidden">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Rate/cs</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyReport.map((r) => {
                      const note = noteForRow(r);
                      return (
                        <TableRow key={`${r.schemeId}_${r.period}`}>
                          <TableCell className="font-medium text-slate-900 min-w-[130px]">{r.supplierName}</TableCell>
                          <TableCell className="text-xs min-w-[150px] max-w-[220px]">{r.productName}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs">{r.period}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">{r.targetQuantity.toLocaleString('en-IN')}</TableCell>
                          <TableCell className={`text-right whitespace-nowrap tabular-nums ${r.achieved ? 'text-emerald-600 font-medium' : ''}`}>
                            {r.actualEligibleQty.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">{inr(r.incentiveRate)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">{inr(r.expectedCredit)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums font-medium text-emerald-700">{inr(r.creditReceived)}</TableCell>
                          <TableCell className="whitespace-nowrap">{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {r.achieved && !note && (
                              <Button size="sm" variant="outline" className="whitespace-nowrap" leftIcon={<FilePlus2 className="w-3.5 h-3.5" />} onClick={() => raiseMonthlyNote(r)}>
                                Raise credit note
                              </Button>
                            )}
                            {note && note.status !== 'settled' && (
                              <Button size="sm" variant="outline" className="whitespace-nowrap" leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => openReceipt(note)}>
                                Record receipt
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Phone (1-col) & Tablet (2-col) cards */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3.5">
                {monthlyReport.map((r) => {
                  const note = noteForRow(r);
                  const drift = note && Math.abs(note.expectedAmount - r.expectedCredit) > 0.5;
                  const pct = r.targetQuantity > 0 ? Math.min(100, Math.round((r.actualEligibleQty / r.targetQuantity) * 100)) : 0;
                  return (
                    <div
                      key={`${r.schemeId}_${r.period}`}
                      data-card-tone={r.achieved ? 'received' : 'sales'}
                      className="rounded-2xl border shadow-xs p-3.5 md:p-4 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 break-words">{r.productName}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {r.supplierName} · {r.period}
                          </p>
                        </div>
                        {statusBadge(r.status)}
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>
                            Sold{' '}
                            <strong className={r.achieved ? 'text-emerald-700' : 'text-slate-800'}>
                              {r.actualEligibleQty.toLocaleString('en-IN')} cs
                            </strong>
                          </span>
                          <span>Target {r.targetQuantity.toLocaleString('en-IN')} cs</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                          <div className={`h-full rounded-full ${r.achieved ? 'bg-emerald-500' : 'bg-sky-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <Stat label={`@ ${inr(r.incentiveRate)}/cs`} value={inr(r.expectedCredit)} />
                        <Stat label="Received" value={inr(r.creditReceived)} tone="good" />
                        <Stat label="Outstanding" value={inr(r.outstandingCredit)} tone={r.outstandingCredit > 0 ? 'warn' : 'default'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {r.calculationMethod === 'excess_only' ? 'Paid on cases above target only' : 'Paid on all cases once target is met'}
                      </p>

                      {drift && note && (
                        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2">
                          <p className="text-xs text-amber-900 leading-snug min-w-0">
                            Sales changed since the credit note was raised. Expected is now <strong>{inr(r.expectedCredit)}</strong> (note says{' '}
                            {inr(note.expectedAmount)}).
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 shrink-0 bg-white"
                            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                            onClick={() => updateSupplierCreditNote(note.id, { expectedAmount: r.expectedCredit })}
                          >
                            Update
                          </Button>
                        </div>
                      )}

                      {r.achieved && !note && (
                        <Button size="sm" variant="outline" className="w-full h-10 mt-3" leftIcon={<FilePlus2 className="w-4 h-4" />} onClick={() => raiseMonthlyNote(r)}>
                          Raise credit note
                        </Button>
                      )}
                      {note && note.status !== 'settled' && (
                        <Button size="sm" variant="outline" className="w-full h-10 mt-3" leftIcon={<CheckCircle2 className="w-4 h-4" />} onClick={() => openReceipt(note)}>
                          Record receipt
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
};
