const slugify = (s = "") =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const createGuestAlias = (name = "") =>
  `guest+${slugify(name) || "x"}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}@growth.local`;

// Quién le debe a quién, a partir del balance de cada participante
export const buildSettlements = (participants = []) => {
  const creditors = participants
    .filter((p) => p.balance > 0.01)
    .map((p) => ({ email: p.email, username: p.username, amount: Number(p.balance) }));
  const debtors = participants
    .filter((p) => p.balance < -0.01)
    .map((p) => ({ email: p.email, username: p.username, amount: Math.abs(Number(p.balance)) }));

  const settlements = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const cr = creditors[ci];
    const de = debtors[di];
    const amount = Math.min(cr.amount, de.amount);
    settlements.push({
      fromName: de.username,
      toName: cr.username,
      amount: Number(amount.toFixed(2)),
    });
    cr.amount = Number((cr.amount - amount).toFixed(2));
    de.amount = Number((de.amount - amount).toFixed(2));
    if (cr.amount <= 0.01) ci += 1;
    if (de.amount <= 0.01) di += 1;
  }
  return settlements;
};
