const STORAGE_KEY = "hepai-coliving-v1";

const defaults = {
  choresDone: false,
  swapRequested: false,
  expenses: [
    { id: "power", name: "8月电费", amount: 286.5, payer: "思思", people: 4, remaining: 214.88, icon: "⚡", date: "9月8日" },
    { id: "internet", name: "家庭宽带", amount: 120, payer: "阿哲", people: 4, remaining: 90, icon: "⌁", date: "9月5日" },
    { id: "clean", name: "清洁用品", amount: 85.6, payer: "小林", people: 4, remaining: 21.62, icon: "🧽", date: "9月2日" },
    { id: "water", name: "饮用水", amount: 534.4, payer: "嘉宁", people: 4, remaining: 0, icon: "💧", date: "8月29日" }
  ],
  supplies: [
    { id: "tissue", name: "抽纸", emoji: "🧻", count: 1, max: 8, threshold: 2, unit: "包", price: 48 },
    { id: "bags", name: "垃圾袋", emoji: "♻️", count: 2, max: 10, threshold: 3, unit: "卷", price: 24 },
    { id: "detergent", name: "洗衣液", emoji: "🫧", count: 7, max: 10, threshold: 2, unit: "成", price: 42 }
  ],
  pacts: [
    { id: "quiet", text: "工作日 23:00 后保持安静", confirmations: 4, confirmedByMe: true },
    { id: "guest", text: "带朋友回家前，在群里提前说一声", confirmations: 3, confirmedByMe: false },
    { id: "clean-rule", text: "做完饭随手清理台面和水槽", confirmations: 4, confirmedByMe: true }
  ],
  activities: [
    { icon: "✓", title: "思思完成了卫生间值日", detail: "本周值日进度 3/4", time: "1小时前" },
    { icon: "¥", title: "阿哲记录了家庭宽带", detail: "¥120 · 4人平摊", time: "周四" },
    { icon: "📦", title: "抽纸库存不足", detail: "剩余 1 包，建议补货", time: "周三" }
  ]
};

const cloneDefaults = () => JSON.parse(JSON.stringify(defaults));
let state = loadState();
let activeSupplyId = "tissue";
let lastFocus = null;

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored ? { ...cloneDefaults(), ...stored } : cloneDefaults();
  } catch { return cloneDefaults(); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const money = value => `¥${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const byId = id => document.getElementById(id);

function render() {
  const pending = state.expenses.reduce((sum, item) => sum + item.remaining, 0);
  const total = state.expenses.reduce((sum, item) => sum + item.amount, 0);
  const unsettled = state.expenses.filter(item => item.remaining > 0).length;
  const low = state.supplies.filter(item => item.count <= item.threshold).length;
  const pendingPacts = state.pacts.filter(item => item.confirmations < 4).length;

  byId("summary-pending").textContent = money(pending);
  byId("summary-pending-note").textContent = `${unsettled} 笔账单未结清`;
  byId("month-total").textContent = money(total);
  byId("expense-pending-total").textContent = money(pending);
  byId("summary-low-stock").textContent = `${low} 件物品`;
  byId("summary-pacts").textContent = `${pendingPacts} 条`;

  const choreButton = byId("complete-chore");
  const badge = byId("chore-status-badge");
  if (state.choresDone) {
    byId("summary-chore").textContent = "厨房 · 已完成";
    byId("summary-chore-note").textContent = "今天的任务已打卡";
    badge.textContent = "已完成";
    badge.className = "status-badge status-success";
    choreButton.textContent = "今日值日已完成";
    choreButton.disabled = true;
  } else {
    byId("summary-chore").textContent = "厨房 · 小林";
    byId("summary-chore-note").textContent = "今晚 21:00 前完成";
    badge.textContent = "待完成";
    badge.className = "status-badge status-warning";
    choreButton.textContent = "完成今日值日";
    choreButton.disabled = false;
  }

  byId("today-chore").innerHTML = `
    <div class="chore-illustration ${state.choresDone ? "is-done" : ""}">🍳</div>
    <div><strong>厨房清洁</strong><p>${state.choresDone ? "小林已完成 · 今天 19:26" : "小林负责 · 今晚 21:00 前"}</p></div>`;

  byId("week-strip").innerHTML = [
    ["周四", "客厅", "思", "avatar-si"], ["周五", "卫生间", "哲", "avatar-zhe"],
    ["今天", "厨房", "林", "avatar-lin"], ["周日", "阳台", "宁", "avatar-ning"]
  ].map((d, i) => `<div class="week-day ${i === 2 ? "is-today" : ""}"><span>${d[0]}</span><i class="week-avatar ${d[3]}">${d[2]}</i><strong>${d[1]}</strong></div>`).join("");

  const shown = state.expenses.slice(0, 4);
  byId("expense-list").innerHTML = shown.map((item, index) => {
    const each = item.amount / item.people;
    return `<div class="expense-row">
      <div class="expense-category">${item.icon}</div>
      <div class="expense-main"><div class="expense-title-line"><strong>${escapeHtml(item.name)}</strong>${index === 0 && item.id.startsWith("new-") ? '<span class="expense-new">刚刚</span>' : ""}</div><div class="expense-meta"><span>${item.payer}垫付</span><span>${item.people}人平摊</span><span>${item.date}</span></div></div>
      <div class="expense-side"><strong>${money(item.amount)}</strong><small>每人 ${money(each)}</small>${item.remaining > 0 ? `<button class="settle-button" data-settle="${item.id}">标记结清</button>` : '<span class="settled-label">✓ 已结清</span>'}</div>
    </div>`;
  }).join("");

  byId("supply-list").innerHTML = state.supplies.map(item => {
    const lowStock = item.count <= item.threshold;
    const percent = Math.max(8, Math.min(100, item.count / item.max * 100));
    return `<div class="supply-row ${lowStock ? "is-low" : ""}"><div class="supply-emoji">${item.emoji}</div><div class="supply-info"><div class="supply-name-line"><strong>${item.name}</strong><span>${lowStock ? `仅剩 ${item.count}${item.unit}` : `余量 ${item.count}/${item.max}`}</span></div><div class="stock-track"><i style="--stock:${percent}%"></i></div></div><button class="restock-button" data-restock="${item.id}">${lowStock ? "补货+记账" : "补货"}</button></div>`;
  }).join("");

  byId("pact-list").innerHTML = state.pacts.map(item => {
    const active = item.confirmations >= 4;
    return `<div class="pact-row ${active ? "" : "is-pending"}"><div class="pact-top"><span class="pact-check ${active ? "" : "is-pending"}">${active ? "✓" : "…"}</span><div class="pact-copy"><strong>${escapeHtml(item.text)}</strong><small>${active ? "全员确认 · 已生效" : `${item.confirmations}/4 位室友已确认`}</small></div>${!item.confirmedByMe ? `<button class="confirm-pact" data-confirm-pact="${item.id}">我确认</button>` : ""}</div><div class="pact-progress"><i style="--progress:${item.confirmations / 4 * 100}%"></i></div></div>`;
  }).join("");

  byId("activity-list").innerHTML = state.activities.slice(0, 4).map(item => `<li class="activity-item"><span class="activity-dot">${item.icon}</span><div class="activity-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><time class="activity-time">${item.time}</time></li>`).join("");

  const tissue = state.supplies.find(item => item.id === "tissue");
  byId("focus-message").textContent = tissue.count <= tissue.threshold ? `抽纸只剩最后 ${tissue.count} 包，补货后可以直接计入本月公摊。` : "抽纸已经补齐，公共账本也自动更新好了。";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function addActivity(icon, title, detail) {
  state.activities.unshift({ icon, title, detail, time: "刚刚" });
}

function openModal(id) {
  const modal = byId(id);
  if (!modal) return;
  lastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => modal.querySelector("input:not([type=hidden]), textarea, select, button")?.focus(), 0);
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.style.overflow = "";
  lastFocus?.focus();
}

function toast(title, detail = "首页状态已同步更新") {
  const item = document.createElement("div");
  item.className = "toast";
  item.innerHTML = `<span class="toast-icon">✓</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div><button aria-label="关闭提示">×</button>`;
  byId("toast-region").append(item);
  item.querySelector("button").addEventListener("click", () => item.remove());
  setTimeout(() => item.remove(), 4200);
}

function prepareRestock(id) {
  const item = state.supplies.find(s => s.id === id);
  if (!item) return;
  activeSupplyId = id;
  byId("restock-item-id").value = id;
  byId("restock-amount").value = item.price;
  byId("restock-quantity").value = item.max;
  byId("restock-modal-title").textContent = `补货${item.name}并记账`;
  byId("restock-description").textContent = `补充${item.name}后，会自动生成一笔 4 人 AA 的公共支出。`;
  updateRestockSplit();
  openModal("restock-modal");
}

function updateRestockSplit() {
  const amount = Number(byId("restock-amount").value) || 0;
  byId("restock-split").textContent = `每人 ${money(amount / 4)}`;
}

document.addEventListener("click", event => {
  const opener = event.target.closest("[data-open-modal]");
  if (opener) openModal(opener.dataset.openModal);
  const closer = event.target.closest("[data-close-modal]");
  if (closer) closeModal(closer.closest(".modal"));
  const restock = event.target.closest("[data-restock]");
  if (restock) prepareRestock(restock.dataset.restock);
  const settle = event.target.closest("[data-settle]");
  if (settle) {
    const item = state.expenses.find(e => e.id === settle.dataset.settle);
    if (item) { item.remaining = 0; addActivity("✓", `${item.name}已结清`, `${money(item.amount)} · 全员完成付款`); saveState(); render(); toast("账单已结清"); }
  }
  const confirmPact = event.target.closest("[data-confirm-pact]");
  if (confirmPact) {
    const item = state.pacts.find(p => p.id === confirmPact.dataset.confirmPact);
    if (item && !item.confirmedByMe) { item.confirmedByMe = true; item.confirmations = Math.min(4, item.confirmations + 1); addActivity("✓", "小林确认了一条公约", item.text); saveState(); render(); toast("已确认这条公约", item.confirmations === 4 ? "全员确认，公约正式生效" : `${item.confirmations}/4 位室友已确认`); }
  }
});

byId("complete-chore").addEventListener("click", () => {
  state.choresDone = true; addActivity("🧹", "小林完成了厨房值日", "本周值日进度 4/4"); saveState(); render(); toast("今日值日已完成", "辛苦啦，家的默契值 +5");
});
byId("swap-chore").addEventListener("click", () => { state.swapRequested = true; saveState(); toast("换班申请已发送给阿哲", "等待对方确认"); });
byId("consume-tissue").addEventListener("click", () => {
  const item = state.supplies.find(s => s.id === "tissue"); item.count = Math.max(0, item.count - 1); addActivity("📦", "小林记录了抽纸消耗", `当前剩余 ${item.count} 包`); saveState(); render(); toast("消耗已记录", item.count <= item.threshold ? "库存偏低，已加入提醒" : "库存状态已更新");
});

byId("restock-amount").addEventListener("input", updateRestockSplit);
byId("restock-form").addEventListener("submit", event => {
  event.preventDefault();
  const item = state.supplies.find(s => s.id === activeSupplyId);
  const amount = Number(byId("restock-amount").value);
  const quantity = Number(byId("restock-quantity").value);
  item.count = quantity;
  state.expenses.unshift({ id: `new-${Date.now()}`, name: `${item.name}补货`, amount, payer: "小林", people: 4, remaining: amount * .75, icon: item.emoji, date: "刚刚" });
  addActivity("¥", `小林补货了${item.name}`, `${money(amount)} · 每人 ${money(amount / 4)}`);
  saveState(); render(); closeModal(byId("restock-modal")); toast("补货完成，账单已生成", `4 人平摊，每人 ${money(amount / 4)}`);
});

function updateExpensePreview() {
  const amount = Number(byId("expense-amount").value) || 0;
  const people = document.querySelectorAll('input[name="participants"]:checked').length;
  byId("expense-split-preview").innerHTML = amount && people ? `共 <strong>${people} 人</strong>参与，每人承担 <strong>${money(amount / people)}</strong>` : "选择参与人并输入金额后，将在这里显示分摊结果";
}
byId("expense-amount").addEventListener("input", updateExpensePreview);
document.querySelectorAll('input[name="participants"]').forEach(input => input.addEventListener("change", updateExpensePreview));
byId("expense-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = byId("expense-name").value.trim();
  const amount = Number(byId("expense-amount").value);
  const people = document.querySelectorAll('input[name="participants"]:checked').length;
  const payerName = byId("expense-payer").selectedOptions[0].textContent.replace("（我）", "");
  if (!people) { toast("请至少选择一位参与人", "才能计算分摊金额"); return; }
  state.expenses.unshift({ id: `new-${Date.now()}`, name, amount, payer: payerName, people, remaining: amount - amount / people, icon: "🧾", date: "刚刚" });
  addActivity("¥", `${payerName}记录了${name}`, `${money(amount)} · ${people}人平摊`); saveState(); render(); event.target.reset(); document.querySelectorAll('input[name="participants"]').forEach(i => i.checked = true); updateExpensePreview(); closeModal(byId("expense-modal")); toast("费用已加入共同账本", `每人 ${money(amount / people)}`);
});

byId("pact-form").addEventListener("submit", event => {
  event.preventDefault(); const text = byId("pact-content").value.trim();
  state.pacts.unshift({ id: `pact-${Date.now()}`, text, confirmations: 1, confirmedByMe: true }); addActivity("✓", "小林提议了一条新公约", text); saveState(); render(); event.target.reset(); closeModal(byId("pact-modal")); toast("公约提议已发出", "已等待另外 3 位室友确认");
});

byId("show-all-expenses").addEventListener("click", () => toast("全部账单已展示", `本月共 ${state.expenses.length} 笔共同支出`));
byId("reset-data").addEventListener("click", () => { if (confirm("确定恢复初始演示数据吗？")) { state = cloneDefaults(); saveState(); render(); toast("演示数据已重置", "可以重新体验完整流程"); } });
document.addEventListener("keydown", event => { if (event.key === "Escape") { const open = document.querySelector(".modal:not([hidden])"); if (open) closeModal(open); } });

const now = new Date();
byId("current-date").textContent = `${now.getMonth() + 1}月${now.getDate()}日 · ${["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][now.getDay()]}`;
render();
