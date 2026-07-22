// admin-core.js — state, i18n, language toggle, toast, chat-bot widget,
// nav (go()), and login/logout. Loaded first: everything else depends on
// the globals and helpers declared here.

// Escapes text before it's inserted via innerHTML/document.write, so data
// coming from customers (order name/phone/address) or Firestore can never
// break out and run as HTML/JS in the admin's logged-in session.
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// بيرجع تاريخ الطلب الحقيقي كـ Date object، من حقل createdAt (اللي فايربيز بيحطه
// أوتوماتيك وقت إنشاء الطلب) — ده أدق من الاعتماد على حقل "date" نصي ممكن يكون
// فاضي لطلبات قديمة اتسجلت قبل ما يتضاف الحقل ده، أو لو الاتصال بالنت قطع لحظة
// الإرسال ومحصلش وقت العميل يتسجل صح.
function getOrderDate(o){
  if(o.createdAt && o.createdAt.seconds) return new Date(o.createdAt.seconds * 1000);
  if(o.date){
    let d = new Date(o.date);
    if(!isNaN(d)) return d;
  }
  return null;
}

// بيرجع نص تاريخ جاهز للعرض للطلب — بيفضّل حقل "date" لو موجود (زي ما هو
// عشان ميتغيرش شكل الطلبات القديمة)، ولو مش موجود بيرجع تاريخ createdAt
// منسّق، ولو ولا ده موجود بيرجع '-'.
function formatOrderDate(o){
  if(o.date) return o.date;
  let d = getOrderDate(o);
  if(!d) return '-';
  return d.toLocaleDateString('ar-EG', {year:'numeric', month:'2-digit', day:'2-digit'}) +
    ' ' + d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
}
let SET=JSON.parse(localStorage.set||'{"name":"JOPA Store","wa":"2010","theme":"#ff6600","gov":[{"n":"العاصمة","v":50}],"categories":[{"id":"all","n":"الكل"},{"id":"electronics","n":"إلكترونيات"},{"id":"fashion","n":"أزياء"},{"id":"cosmetics","n":"تجميل"}],"cpOn":false,"cpCode":"SALE50","cpVal":10,"skipCart":false,"clientNote":"","fakeCounterOn":true,"fakeCounterNum":15,"countDownOn":true,"countDownHours":2,"countDownMins":30,"countDownSecs":0,"countDownText":"ينتهي العرض الخاص خلال","fbPixelId":"","tiktokPixelId":"","vodafoneOn":false,"vodafoneNumber":"","shippingPolicyOn":false,"shippingPolicyText":"","altPhoneOn":false}');

let PROD=[];
let ORD=[];
let currentFilter = 'all';
let CART={};let TMP_MEDIA=[];let LAST={};let CHK_OPTS={};let COUPON=0;
let TMP_SZ=[];let TMP_CL=[];let TMP_CL_STOCK={};let TMP_SZ_STOCK={};let TMP_CUSTOM=[];
let LANG = localStorage.lang || 'ar';
let timerIntervalGlobal = null;
let pixelsInitialized = false;
let VF_SCREENSHOT = null;
let STORE_VISITS = 0;

const i18n = {
  ar: {
    nav_store: "المتجر", nav_products: "المنتجات", nav_suppliers: "الموردين", nav_orders: "الطلبات", nav_dash: "الإحصائيات", nav_settings: "الاعدادات", nav_cart: "السلة", logout: "خروج",
    login_title: "دخول لوحة التحكم", login_btn: "دخول", forgot_btn: "نسيت كلمة السر؟", login_err: "بيانات غلط", default_login: "الافتراضي: admin / 1234",
    reset_title: "استرجاع", reset_code_lbl: "الكود", change_btn: "تغيير", back_btn: "رجوع", manage_prod: "ادارة المنتجات", add_new_prod: "اضافة منتج جديد",
    show_stock_lbl: "اظهار المخزون الكلي للعميل ✓", sizes: "المقاسات", colors: "الالوان", color_stock_lbl: "مخزون الالوان - انت بس", size_stock_lbl: "مخزون المقاسات - انت بس",
    add_prod_btn: "اضافة المنتج", th_img: "الميديا", th_name: "الاسم", th_price: "السعر", th_stock: "المخزون", th_action: "إجراء الحذف", total_sales: "إجمالي المبيعات",
    net_profit: "صافي الأرباح", sold_qty: "القطع المباعة", prod_perf: "تفاصيل أداء المنتجات", th_rem_stock: "المخزون المتبقي", th_sold_qty: "الكمية المباعة",
    th_total_rev: "إجمالي الإيرادات", th_prod_prof: "الأرباح", store_settings: "إعدادات المتجر", store_name_lbl: "اسم المتجر", whatsapp_lbl: "واتساب", site_color_lbl: "لون الموقع الأساسي",
    new_user_lbl: "اسم مستخدم جديد", new_pass_lbl: "كلمة مرور جديدة", coupon_settings: "إعدادات الكوبون", enable_coupon: "تفعيل الكوبونات", add_gov: "+ محافظة", save_changes: "حفظ التغييرات",
    checkout_title: "إتمام الطلب", shipping_info: "بيانات الشحن", apply_btn: "تطبيق", confirm_order: "تأكيد الطلب", cancel_btn: "إلغاء", count_lbl: "العدد",
    empty_cart: "السلة فارغة", item_out: "المنتج نفذ", added_cart: "تم الإضافة للسلة", max_stock: "المخزون الكلي المتاح فقط", select_size: "اختار مقاس لـ", select_color: "اختار لون لـ",
    ordered_msg: "تم الطلب بنجاح", del_confirm_prod: "هل أنت متأكد من حذف هذا المنتج؟", del_confirm_ord: "هل أنت متأكد من حذف هذا الطلب؟", order_no: "طلب رقم", total_lbl: "الإجمالي",
    status_new: "جديد", status_ok: "تم التسليم", status_cancel: "ملغي", btn_delivery: "تم التسليم", btn_cancel: "إلغاء الطلب", btn_delete: "حذف", currency: "جنيه", pcs: "قطعة", no_orders: "لا يوجد طلبات حالياً",
    placeholder_name: "الاسم بالكامل", placeholder_phone: "رقم الموبايل", placeholder_address: "العنوان بالتفصيل", placeholder_coupon: "كود الكوبون", select_gov: "اختار المحافظة"
  },
  en: {
    nav_store: "Store", nav_products: "Products", nav_suppliers: "Suppliers", nav_orders: "Orders", nav_dash: "Dashboard", nav_settings: "Settings", nav_cart: "Cart", logout: "Logout",
    login_title: "Admin Login", login_btn: "Login", forgot_btn: "Forgot Password?", login_err: "Invalid Data", default_login: "Default: admin / 1234",
    reset_title: "Reset", reset_code_lbl: "Code", change_btn: "Change", back_btn: "Back", manage_prod: "Manage Products", add_new_prod: "Add New Product",
    show_stock_lbl: "Show stock to client ✓", sizes: "Sizes", colors: "Colors", color_stock_lbl: "Color Stock (Admin Only)", size_stock_lbl: "Size Stock (Admin Only)",
    add_prod_btn: "Add Product", th_img: "Media", th_name: "Name", th_price: "Price", th_stock: "Stock", th_action: "Action", total_sales: "Total Sales",
    net_profit: "Net Profit", sold_qty: "Items Sold", prod_perf: "Product Performance", th_rem_stock: "Rem. Stock", th_sold_qty: "Sold Qty",
    th_total_rev: "Total Revenue", th_prod_prof: "Profit", store_settings: "Store Settings", store_name_lbl: "Store Name", whatsapp_lbl: "WhatsApp", site_color_lbl: "Theme Color",
    new_user_lbl: "New Admin User", new_pass_lbl: "New Admin Password", coupon_settings: "Coupon Settings", enable_coupon: "Enable Coupon Usage", add_gov: "+ Governorate", save_changes: "Save Changes",
    checkout_title: "Checkout", shipping_info: "Shipping Information", apply_btn: "Apply", confirm_order: "Confirm Order", cancel_btn: "Cancel", count_lbl: "Count",
    empty_cart: "Cart is empty", item_out: "Out of stock", added_cart: "Added to cart", max_stock: "Available stock limit reached", select_size: "Select size for ", select_color: "Select color for ",
    ordered_msg: "Order placed successfully", del_confirm_prod: "Are you sure you want to delete this product?", del_confirm_ord: "Are you sure you want to delete this order?", order_no: "Order ID", total_lbl: "Total",
    status_new: "New", status_ok: "Delivered", status_cancel: "Cancelled", btn_delivery: "Deliver", btn_cancel: "Cancel", btn_delete: "Delete", currency: "EGP", pcs: "Pcs", no_orders: "No orders found",
    placeholder_name: "Full Name", placeholder_phone: "Mobile Number", placeholder_address: "Detailed Address", placeholder_coupon: "Coupon Code", select_gov: "Select Governorate"
  }
};

function applyTheme(color){
  document.documentElement.style.setProperty('--main', color);
  document.documentElement.style.setProperty('--main-dark', color + 'cc');
}

function updateLangDOM(){
  let h = document.getElementById('htmlTag');
  h.setAttribute('lang', LANG);
  h.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr');
  document.getElementById('langBtn').innerText = LANG === 'ar' ? 'EN' : 'AR';
  
  document.querySelectorAll('[data-key]').forEach(el => {
    let key = el.getAttribute('data-key');
    if(i18n[LANG][key]) el.innerText = i18n[LANG][key];
  });

  document.getElementById('cn').placeholder = i18n[LANG].placeholder_name;
  document.getElementById('cp').placeholder = i18n[LANG].placeholder_phone;
  document.getElementById('ca').placeholder = i18n[LANG].placeholder_address;
  document.getElementById('coupon').placeholder = i18n[LANG].placeholder_coupon;
}

function toggleLang(){
  LANG = LANG === 'ar' ? 'en' : 'ar';
  localStorage.lang = LANG;
  updateLangDOM();
  if(document.getElementById('store').classList.contains('on')) drawStore();
  if(document.getElementById('products').classList.contains('on')) drawP();
  if(document.getElementById('orders').classList.contains('on')) drawO();
  if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
}

function toast(t){let e=document.getElementById('toast');e.innerText=t;e.style.display='block';setTimeout(()=>e.style.display='none',2500)}

let BOT_MSGS = JSON.parse(localStorage.botChat || '[]');
const BOT_QUICK_REPLIES = [
  {label:'🆕 ايه الجديد؟', text:'ايه الجديد في المتجر؟'},
  {label:'🎁 عروض وخصومات', text:'في عروض ولا خصومات دلوقتي؟'},
  {label:'📦 سياسة الشحن', text:'ايه سياسة الشحن والاسترجاع؟'},
  {label:'🚚 مصاريف الشحن', text:'الشحن بكام؟'},
  {label:'💳 طرق الدفع', text:'ايه طرق الدفع المتاحة؟'},
  {label:'📞 كلمونا', text:'عايز اتواصل مع خدمة العملاء'}
];

function renderBotQuick(){
  let box = document.getElementById('botQuick');
  if(!box) return;
  box.innerHTML = BOT_QUICK_REPLIES.map(q => `<button type="button" class="bot-chip" onclick='sendBotQuick(${JSON.stringify(q.text)})'>${q.label}</button>`).join('');
}

function sendBotQuick(text){
  addBotMessage('user', text);
  setTimeout(() => addBotMessage('bot', botReply(text)), 300);
}

function renderBotMessages(){
  let box = document.getElementById('botMessages');
  if(!box) return;
  box.innerHTML = BOT_MSGS.map(m => `<div class="bot-msg ${m.from}">${m.text}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function addBotMessage(from, text){
  BOT_MSGS.push({from, text});
  if(BOT_MSGS.length > 60) BOT_MSGS = BOT_MSGS.slice(-60);
  localStorage.botChat = JSON.stringify(BOT_MSGS);
  renderBotMessages();
  if(from === 'bot' && !document.getElementById('botPanel').classList.contains('on')){
    document.getElementById('botBadge').style.display = 'block';
  }
}

function toggleBotPanel(){
  let panel = document.getElementById('botPanel');
  panel.classList.toggle('on');
  document.getElementById('botStoreName').innerText = SET.name || 'المتجر';
  if(panel.classList.contains('on')){
    document.getElementById('botBadge').style.display = 'none';
    renderBotQuick();
    if(BOT_MSGS.length === 0){
      addBotMessage('bot', `أهلاً بيك في ${SET.name || 'متجرنا'} 👋 تقدر تسألني عن المنتجات، العروض، الشحن، أو أي حاجة جديدة في المتجر.`);
    } else {
      renderBotMessages();
    }
    document.getElementById('botInput').focus();
  }
}

function sendBotMsg(){
  let input = document.getElementById('botInput');
  let text = input.value.trim();
  if(!text) return;
  addBotMessage('user', text);
  input.value = '';
  setTimeout(() => addBotMessage('bot', botReply(text)), 300);
}

function botReply(text){
  let t = text.toLowerCase();
  if(/مرحبا|اهلا|هاي|hello|hi\b|السلام عليكم/.test(t)){
    return `أهلاً بيك في ${SET.name || 'متجرنا'} 👋 اسألني عن أي حاجة تحب تعرفها.`;
  }
  if(/شكرا|متشكر|thanks|تسلم/.test(t)){
    return 'العفو 🌸 تحت أمرك في أي وقت.';
  }
  if(/سياسة الشحن|سياسه الشحن|استرجاع|ارجاع|استبدال/.test(t)){
    if(SET.shippingPolicyOn && SET.shippingPolicyText) return '📦 سياسة الشحن:\n' + SET.shippingPolicyText;
    return 'لسه مفيش سياسة شحن مفصّلة متاحة دلوقتي، تقدر تتواصل معانا عشان أي استفسار.';
  }
  if(/جديد|احدث|وصل/.test(t)){
    if(!PROD.length) return 'لسه مفيش منتجات مضافة في المتجر حالياً.';
    let latest = PROD.slice(-3);
    return 'أحدث المنتجات عندنا:\n' + latest.map(p => `• ${p.n} - ${p.disc && p.disc<p.v? p.disc : p.v} ${i18n[LANG].currency}`).join('\n');
  }
  if(/قسم|اقسام|فئات|تصنيف/.test(t)){
    if(SET.categories && SET.categories.length) return 'أقسام المتجر:\n' + SET.categories.map(c=>`• ${c}`).join('\n');
    return 'المنتجات عندنا معروضة كلها في صفحة المتجر الرئيسية.';
  }
  if(/عرض|خصم|كوبون|تخفيض/.test(t)){
    let parts = [];
    if(SET.cpOn && SET.cpCode) parts.push(`فيه كود خصم شغال دلوقتي: ${SET.cpCode} (خصم ${SET.cpVal || ''}%)، جربه في صفحة الدفع.`);
    let discounted = PROD.filter(p => p.disc && p.disc < p.v).slice(0,3);
    if(discounted.length) parts.push('منتجات عليها خصم:\n' + discounted.map(p=>`• ${p.n}: ${p.v} → ${p.disc} ${i18n[LANG].currency}`).join('\n'));
    if(SET.countDownOn && SET.countDownText) parts.push(`⏰ ${SET.countDownText}`);
    return parts.length? parts.join('\n\n') : 'مفيش عروض خاصة دلوقتي، لكن تابعنا عشان تعرف أول بأول.';
  }
  if(/شحن|توصيل|تشحن/.test(t)){
    let parts = [];
    if(SET.gov && SET.gov.length) parts.push('أسعار الشحن حسب المحافظة:\n' + SET.gov.map(g=>`• ${g.n}: ${g.v} ${i18n[LANG].currency}`).join('\n'));
    if(SET.shippingPolicyOn && SET.shippingPolicyText) parts.push('📦 سياسة الشحن:\n' + SET.shippingPolicyText);
    return parts.length ? parts.join('\n\n') : 'التوصيل متاح لكل المحافظات، هيتقالك السعر بالظبط في صفحة الدفع.';
  }
  if(/فودافون|كاش|دفع/.test(t)){
    if(SET.vodafoneOn && SET.vodafoneNumber) return `الدفع متاح عن طريق فودافون كاش على الرقم ${SET.vodafoneNumber}، أو الدفع عند الاستلام.`;
    return 'الدفع متاح عند استلام الأوردر.';
  }
  if(/طلبي|اوردر|فين طلبي|حالة الطلب/.test(t)){
    return 'تقدر تتابع حالة طلبك بسهولة عن طريق التواصل معانا على الواتساب وذكر اسمك ورقم الموبايل اللي طلبت بيه.';
  }
  if(/مقاس|مقاسات|لون|الوان/.test(t)){
    return 'المقاسات والألوان المتاحة لكل منتج موجودة جوه صفحة المنتج نفسه.';
  }
  if(/واتساب|تواصل|اتصال|رقم التليفون/.test(t)){
    return 'تقدر تتواصل معانا مباشرة من زرار الواتساب الأخضر 💬 تحت.';
  }
  let matchedProduct = PROD.find(p => p.n && t.includes(p.n.toLowerCase()));
  if(matchedProduct){
    let price = matchedProduct.disc && matchedProduct.disc < matchedProduct.v ? matchedProduct.disc : matchedProduct.v;
    let stockText = matchedProduct.stock > 0 ? 'متوفر' : 'غير متوفر حالياً';
    return `${matchedProduct.n}: ${price} ${i18n[LANG].currency} - ${stockText}`;
  }
  return 'تقدر تسألني عن: المنتجات الجديدة، الأقسام، العروض، سياسة الشحن، أو طرق الدفع. أو كلمنا على الواتساب لو محتاج مساعدة شخص حقيقي 💬';
}

function checkStoreUpdates(){
  let seenRaw = localStorage.botSeenSettings;
  let current = {cpOn:!!SET.cpOn, cpCode:SET.cpCode||'', shippingPolicyOn:!!SET.shippingPolicyOn, countDownOn:!!SET.countDownOn, countDownText:SET.countDownText||'', vodafoneOn:!!SET.vodafoneOn};
  if(seenRaw === undefined){ localStorage.botSeenSettings = JSON.stringify(current); return; }
  let seen = JSON.parse(seenRaw || '{}');
  let msgs = [];
  if(current.cpOn && (!seen.cpOn || seen.cpCode !== current.cpCode) && current.cpCode) msgs.push(`🎁 في كود خصم جديد شغال دلوقتي: ${current.cpCode}`);
  if(current.shippingPolicyOn && !seen.shippingPolicyOn) msgs.push('📦 تمت إضافة سياسة شحن جديدة، اسألني عنها لو حابب.');
  if(current.countDownOn && (!seen.countDownOn || seen.countDownText !== current.countDownText) && current.countDownText) msgs.push(`⏰ عرض جديد: ${current.countDownText}`);
  if(current.vodafoneOn && !seen.vodafoneOn) msgs.push('💜 بقى متاح الدفع بفودافون كاش دلوقتي.');
  msgs.forEach(m => addBotMessage('bot', m));
  localStorage.botSeenSettings = JSON.stringify(current);
}

function checkNewProducts(){
  let seenRaw = localStorage.botSeenProducts;
  let currentIds = PROD.map(p=>p.id);
  if(seenRaw === undefined){
    localStorage.botSeenProducts = JSON.stringify(currentIds);
    return;
  }
  let seen = JSON.parse(seenRaw || '[]');
  let newOnes = PROD.filter(p => !seen.includes(p.id));
  if(newOnes.length && seen.length){
    newOnes.forEach(p=>{
      let price = p.disc && p.disc<p.v? p.disc : p.v;
      addBotMessage('bot', `🆕 وصل منتج جديد للمتجر: ${p.n} بسعر ${price} ${i18n[LANG].currency}`);
    });
  }
  localStorage.botSeenProducts = JSON.stringify(currentIds);
}

function showShipPolicy(){
  document.getElementById('shipPolicyText').innerText = SET.shippingPolicyText || 'لا توجد سياسة شحن مضافة حالياً.';
  document.getElementById('shipPolicyOverlay').style.display='flex';
}
function hideShipPolicy(){ document.getElementById('shipPolicyOverlay').style.display='none'; }

function go(id){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  window.scrollTo(0,0);
  if(id=='store')drawStore();
  if(id=='products')drawP();
  if(id=='suppliers') drawSuppliers();
  if(id=='orders'){ drawO(); clearNewOrderBadge(); }
  if(id=='settings')drawS();
  if(id=='dashboard')drawDashboard();
  
  if(id !== 'landingPage' && id !== 'checkout' && timerIntervalGlobal) {
     clearInterval(timerIntervalGlobal);
  }
}

function saveAll(){
  localStorage.set = JSON.stringify(SET);
}

let AUTH_READY = false;

async function doLogin(){
  let btn = document.getElementById('loginBtn');
  let errEl = document.getElementById('err');
  btn.disabled = true; btn.innerText = 'جاري الدخول...';
  errEl.style.display = 'none';

  // استنى Auth يكون جاهز (لحد 8 ثواني)
  let waited = 0;
  while(!AUTH_READY && waited < 80){ await new Promise(r=>setTimeout(r,100)); waited++; }

  if(!AUTH_READY){
    btn.disabled=false; btn.innerText='دخول';
    errEl.innerText='تحقق من الإنترنت وحاول تاني'; errEl.style.display='block'; return;
  }
  try {
    await window._fbSignIn(window._fbAuth, u.value.trim(), p.value);
    // onAuthStateChanged هيكمل باقي الشغل
  } catch(e){
    btn.disabled=false; btn.innerText='دخول';
    let msg = 'بيانات غلط';
    if(e.code==='auth/network-request-failed') msg='تحقق من الإنترنت';
    else if(e.code==='auth/too-many-requests') msg='حاولت كتير، انتظر شوية';
    else if(e.code==='auth/invalid-email') msg='الإيميل غلط';
    errEl.innerText=msg; errEl.style.display='block';
  }
}

function doLogout(){
  if(window._fbAuth && window._fbSignOut) window._fbSignOut(window._fbAuth).catch(()=>{});
  document.getElementById('menu').style.display='none';
  go('login');
}
function logout(){ doLogout(); }

async function doForgotPassword(){
  let email = document.getElementById('resetEmail').value.trim();
  let msg = document.getElementById('resetMsg');
  if(!email){ toast('اكتب الإيميل الأول'); return; }
  if(!AUTH_READY){ toast('انتظر ثانية وحاول تاني'); return; }
  try {
    await window._fbResetPwd(window._fbAuth, email);
    msg.style.color='green'; msg.innerText='تم الإرسال — افتح إيميلك واتبع الرابط'; msg.style.display='block';
  } catch(e){
    msg.style.color='red'; msg.innerText='إيميل غير مسجل أو خطأ في الاتصال'; msg.style.display='block';
  }
}

