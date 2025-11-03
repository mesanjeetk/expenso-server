function createEvenReimbursements(members, payerId, totalAmount) {
  const n = members.length;
  const per = Math.round((totalAmount / n) * 100) / 100; // round to 2 decimals
  return members.map(m => ({
    user: m._id,
    amount: (m._id.equals(payerId) ? 0 : per),
    received: false
  }));
}