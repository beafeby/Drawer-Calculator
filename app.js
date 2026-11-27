const $ = id => document.getElementById(id);
const bills = [
  ["₱1",1],["₱5",5],["₱20",20],["₱50",50],
  ["₱100",100],["₱200",200],["₱500",500],["₱1,000",1000]
];
const money = n => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(n)||0);
const val = id => Math.max(0, Number($(id).value) || 0);
const sumLines = text => text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
  .reduce((sum,line)=>sum + (Number.isFinite(Number(line)) ? Number(line) : 0),0);
const fmtQty = n => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));

$("denominations").innerHTML = bills.map(([label,amount],i)=>`
  <div class="denom-row">
    <strong class="denom-value">${label}</strong>
    <input id="qty${i}" type="number" min="0" step="1" inputmode="decimal" aria-label="${label} quantity" placeholder="Qty">
    <span class="times">=</span>
    <input id="amt${i}" type="number" min="0" step="0.01" inputmode="decimal" aria-label="${label} total amount" placeholder="0.00">
  </div>`).join("");

function syncFromQty(i) {
  const quantity = Math.max(0, Number($(`qty${i}`).value) || 0);
  $(`amt${i}`).value = quantity ? (quantity * bills[i][1]).toFixed(2) : "";
  calculate();
}
function syncFromAmount(i) {
  const amount = Math.max(0, Number($(`amt${i}`).value) || 0);
  const quantity = amount / bills[i][1];
  $(`qty${i}`).value = amount ? fmtQty(quantity) : "";
  calculate();
}
bills.forEach((_,i)=>{
  $(`qty${i}`).addEventListener("input",()=>syncFromQty(i));
  $(`amt${i}`).addEventListener("input",()=>syncFromAmount(i));
});

function calculate() {
  const billAmounts = bills.map((_,i)=>val(`amt${i}`));
  const cash = billAmounts.reduce((a,b)=>a+b,0) + val("looseCoins");
  const otherCash = val("otherCash");
  const allTotalCash = cash + otherCash;
  const pcvLoose = sumLines($("pcvLoose").value);
  const pcvHand = sumLines($("pcvHand").value);
  const pcvHeadOffice = sumLines($("pcvHeadOffice").value);
  const pcvTotal = pcvLoose + pcvHand + pcvHeadOffice;
  const drawer = val("drawer");
  const grand = allTotalCash + pcvTotal;
  const variance = grand - drawer;

  $("cashTotal").textContent = money(cash);
  $("pcvLooseSubtotal").textContent = money(pcvLoose);
  $("pcvHandSubtotal").textContent = money(pcvHand);
  $("pcvHeadOfficeSubtotal").textContent = money(pcvHeadOffice);
  $("pcvTotal").textContent = money(pcvTotal);
  $("summaryCash").textContent = money(cash);
  $("summaryOtherCash").textContent = money(otherCash);
  $("allTotalCash").textContent = money(allTotalCash);
  $("summaryPcv").textContent = money(pcvTotal);
  $("summaryDrawer").textContent = money(drawer);
  $("grandTotal").textContent = money(grand);
  $("variance").textContent = money(variance);
  $("variance").classList.toggle("positive",variance>0);
  $("variance").classList.toggle("negative",variance<0);
  $("varianceNote").textContent = variance > 0 ? "Over · Grand Total is above Cash in Drawer" :
    variance < 0 ? "Short · Cash in Drawer is above Grand Total" : "Balanced · Cash in Drawer matches Grand Total";
  return {cash,otherCash,allTotalCash,pcvLoose,pcvHand,pcvHeadOffice,pcvTotal,drawer,grand,variance,billAmounts};
}

function getRecords() {
  try { return JSON.parse(localStorage.getItem("cashierRecords") || "[]"); }
  catch { return []; }
}
function setRecords(records) { localStorage.setItem("cashierRecords",JSON.stringify(records)); }
function formData() {
  const totals = calculate();
  const billCounts = {};
  const billTotals = {};
  bills.forEach(([label],i)=>{
    billCounts[label] = Number($(`qty${i}`).value) || 0;
    billTotals[label] = Number($(`amt${i}`).value) || 0;
  });
  return {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    date:$("date").value, cashier:$("cashier").value.trim(),
    billCounts,billTotals,looseCoins:val("looseCoins"),
    pcvLooseEntries:$("pcvLoose").value,pcvHandEntries:$("pcvHand").value,
    pcvHeadOfficeEntries:$("pcvHeadOffice").value,
    ...totals,savedAt:new Date().toISOString()
  };
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderRecords() {
  const records=getRecords();
  $("recordCount").textContent=`(${records.length})`;
  $("records").innerHTML = records.length ? records.map(r=>`
    <article class="record">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <h3>${escapeHtml(r.cashier || "Unnamed cashier")}</h3><strong>${money(r.grand)}</strong>
      </div>
      <small>${escapeHtml(r.date || "")}</small>
      <div class="muted" style="margin:7px 0">Total Cash ${money(r.cash)} · All Total Cash ${money(r.allTotalCash)} · PCV ${money(r.pcvTotal)} · Drawer ${money(r.drawer)}</div>
      <div class="muted">Variance: <strong>${money(r.variance)}</strong></div>
      <button class="danger" type="button" data-delete="${escapeHtml(r.id)}" style="margin-top:8px">Delete record</button>
    </article>`).join("") : '<p class="muted">No records saved yet.</p>';
}
function resetForm() {
  document.querySelectorAll("main input, main textarea").forEach(el=>{
    if(el.id==="date") el.value=new Date().toISOString().slice(0,10);
    else el.value="";
  });
  calculate();
}
document.querySelectorAll("main input, main textarea").forEach(el=>{
  if(!/^qty\d+$/.test(el.id) && !/^amt\d+$/.test(el.id)) el.addEventListener("input",calculate);
});
$("date").value=new Date().toISOString().slice(0,10);
$("saveBtn").addEventListener("click",()=>{
  const record=formData();
  if(!record.cashier){alert("Please enter the cashier name before saving.");$("cashier").focus();return;}
  const records=getRecords(); records.unshift(record); setRecords(records); renderRecords();
  alert("Cashier record saved on this device.");
});
$("clearBtn").addEventListener("click",()=>{
  if(confirm("Clear all entries in the form?")) resetForm();
});
$("toggleRecords").addEventListener("click",()=>{
  $("records").classList.toggle("hidden");
  $("toggleRecords").textContent=$("records").classList.contains("hidden")?"Show":"Hide";
});
$("records").addEventListener("click",e=>{
  const id=e.target.dataset.delete;
  if(!id)return;
  if(confirm("Delete this saved record?")){setRecords(getRecords().filter(r=>String(r.id)!==String(id)));renderRecords();}
});
$("exportBtn").addEventListener("click",()=>{
  const records=getRecords();
  if(!records.length){alert("There are no records to export yet.");return;}

  // Vertical layout: labels down column A, each saved record in its own column.
  const rows = [
    ["DATE", ...records.map(r=>r.date || "")],
    ["NAME", ...records.map(r=>r.cashier || "")],
    [""],
    ...bills.map(([label])=>{
      const row=[label];
      records.forEach(record=>{
        const qty=Number(record.billCounts?.[label] ?? 0);
        const amount=Number(record.billTotals?.[label] ?? (qty * Number(label.replace(/[₱,]/g,""))));
        row.push(`${qty} - ${money(amount)}`);
      });
      return row;
    }),
    ["LOOSE COINS", ...records.map(r=>money(r.looseCoins))],
    ["TOTAL CASH", ...records.map(r=>money(r.cash))],
    ["OTHER CASH", ...records.map(r=>money(r.otherCash))],
    ["ALL TOTAL CASH", ...records.map(r=>money(r.allTotalCash))],
    ["PCV LOOSE", ...records.map(r=>money(r.pcvLoose))],
    ["PCV HAND", ...records.map(r=>money(r.pcvHand))],
    ["PCV HEAD", ...records.map(r=>money(r.pcvHeadOffice))],
    ["TOTAL PCV", ...records.map(r=>money(r.pcvTotal))],
    ["GRAND TOTAL", ...records.map(r=>money(r.grand))],
    ["CASH IN DRAWER", ...records.map(r=>money(r.drawer))],
    ["VARIANCE", ...records.map(r=>money(r.variance))]
  ];
  const quote=value=>`"${String(value ?? "").replace(/"/g,'""')}"`;
  const csv="\ufeff"+rows.map(row=>row.map(quote).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`cashier-records-${new Date().toISOString().slice(0,10)}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
calculate();
renderRecords();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
