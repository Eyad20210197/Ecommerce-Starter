/**
 * Storefront Internationalization (i18n)
 * Supports English and Arabic with automatic RTL text direction.
 */

export const dictionary = {
  ar: Object.fromEntries(`
Shop|المتجر
Cart|السلة
Account|حسابي
Sign in|تسجيل الدخول
Sign out|تسجيل الخروج
Workspace|لوحة الإدارة
Collection|المنتجات
Search products|البحث عن منتجات
Search products & tags|البحث عن منتجات ووسوم
Search products, tags...|ابحث في المنتجات والوسوم...
Matching tags|وسوم مطابقة
Matching products|منتجات مطابقة
Tag|وسم
Tags|الوسوم
Clear all|مسح الكل
No matches found|لا توجد نتائج مطابقة
Search|بحث
Categories|الفئات
All products|كل المنتجات
Filters|التصفية
Availability|التوفر
In stock only|المتوفر فقط
Sort by|الترتيب
Newest|الأحدث
Price: low to high|السعر: الأقل أولاً
Price: high to low|السعر: الأعلى أولاً
Name|الاسم
Add to cart|أضف للسلة
Out of stock|غير متوفر
No image|لا توجد صورة
Quantity|الكمية
Description|الوصف
Continue shopping|متابعة التسوق
Your cart|سلة التسوق
Remove|إزالة
Checkout|إتمام الطلب
Subtotal|المجموع الفرعي
Shipping|الشحن
Tax|الضريبة
Total|الإجمالي
Cash on delivery|الدفع عند الاستلام
Online payment|الدفع الإلكتروني
Order summary|ملخص الطلب
Delivery address|عنوان التوصيل
Contact details|بيانات الاتصال
Full name|الاسم الكامل
Email|البريد الإلكتروني
Phone|الهاتف
Address line 1|العنوان
Address line 2|تفاصيل إضافية
City|المدينة
State / region|الولاية / المنطقة
Postal code|الرمز البريدي
Country code|رمز الدولة
Payment method|طريقة الدفع
Order notes|ملاحظات الطلب
Place order|تأكيد الطلب
Save this address|حفظ العنوان
Saved addresses|العناوين المحفوظة
Use a new address|استخدام عنوان جديد
Your order is placed.|تم تأكيد طلبك.
Order|طلب
Orders|الطلبات
Order history|سجل الطلبات
Invoice|الفاتورة
Print invoice|طباعة الفاتورة
Cancel order|إلغاء الطلب
Request a return|طلب إرجاع
Return reason|سبب الإرجاع
Submit request|إرسال الطلب
Order details|تفاصيل الطلب
Profile|الملف الشخصي
Save changes|حفظ التغييرات
Password|كلمة المرور
Current password|كلمة المرور الحالية
New password|كلمة المرور الجديدة
Change password|تغيير كلمة المرور
Create account|إنشاء حساب
Already have an account?|لديك حساب بالفعل؟
New customer?|عميل جديد؟
At least 12 characters|12 حرفاً على الأقل
Address label|اسم العنوان
Add address|إضافة عنوان
Edit|تعديل
Delete|حذف
Save|حفظ
Cancel|إلغاء
Close|إغلاق
Previous|السابق
Next|التالي
Products|المنتجات
Inventory|المخزون
Reports|التقارير
Employees|الموظفون
Audit log|سجل الإجراءات
Settings|الإعدادات
Owner dashboard|لوحة المالك
Store dashboard|لوحة المتجر
Warehouse dashboard|لوحة المستودع
Add product|إضافة منتج
Product name|اسم المنتج
SKU|رمز المنتج
Price|السعر
Category|الفئة
Tags|الوسوم
Image URL|رابط الصورة
Active|نشط
Track serial numbers|تتبع الأرقام التسلسلية
Archive|أرشفة
Stock|المخزون
On hand|الموجود
Reserved|المحجوز
Available|المتاح
Receive stock|استلام مخزون
Adjust stock|تعديل المخزون
Stock movements|حركات المخزون
Serial numbers|الأرقام التسلسلية
Reason|السبب
Reference|المرجع
Date|التاريخ
Status|الحالة
Amount|المبلغ
Customer|العميل
Payment|الدفع
Prepare|تجهيز
Dispatch|إرسال
Mark delivered|تأكيد التوصيل
Complete|إكمال
Record cash collection|تسجيل تحصيل النقد
Approve return|قبول الإرجاع
Reject return|رفض الإرجاع
Receive return|استلام المرتجع
Refund payment|رد المبلغ
Note|ملاحظة
Restock after inspection|إعادة للمخزون بعد الفحص
Tracking URL|رابط التتبع
Shipment reference|مرجع الشحنة
Save shipment|حفظ الشحنة
Request shipment|طلب شحن
From|من
To|إلى
Apply|تطبيق
Collected|المحصّل
Refunded|المسترد
Sales|المبيعات
Low stock|مخزون منخفض
Units|الوحدات
Retail inventory value|قيمة المخزون بسعر البيع
Add employee|إضافة موظف
Role|الدور
Enabled|مفعّل
Disabled|معطّل
Action|الإجراء
Employee|الموظف
Details|التفاصيل
Payment integration|تكامل الدفع
Shipping integration|تكامل الشحن
Multiple currencies|عملات متعددة
Multiple languages|لغات متعددة
Future features|خصائص مستقبلية
Google sign-in|تسجيل الدخول بجوجل
Customer service|خدمة العملاء
AI chatbot|المساعد الذكي
Logistics|الخدمات اللوجستية
No products found|لا توجد منتجات
Try another search or filter.|جرّب بحثاً أو تصفية أخرى.
Your cart is empty|سلتك فارغة
No orders yet|لا توجد طلبات حتى الآن
Nothing to show yet.|لا توجد بيانات بعد.
Loading…|جارٍ التحميل…
Retry|إعادة المحاولة
Saved.|تم الحفظ.
Added to cart.|تمت الإضافة للسلة.
New address|عنوان جديد
All statuses|كل الحالات
Pay now|الدفع الآن
Order activity|سجل الطلب
Return|الإرجاع
Support|الدعم
placed|تم الطلب
preparing|قيد التجهيز
dispatched|تم الإرسال
delivered|تم التوصيل
completed|مكتمل
cancelled|ملغي
returned|مرتجع
pending|قيد الانتظار
paid|مدفوع
refunded|مسترد
void|ملغى
requested|مطلوب
approved|مقبول
rejected|مرفوض
received|مستلم
owner|المالك
manager|مدير المتجر
warehouse|المستودع
customer|العميل
available|متاح
reserved|محجوز
sold|مباع
quarantine|قيد الفحص
removed|مستبعد
Minimum price|أقل سعر
Maximum price|أعلى سعر
Any tag|كل الوسوم
Back to orders|العودة للطلبات
New category|فئة جديدة
Slug|معرّف الفئة
Arabic name|الاسم بالعربية
Arabic description|الوصف بالعربية
Manual|يدوي
Configuration|التكوين
Inventory value uses retail prices.|قيمة المخزون محسوبة بأسعار البيع.
Full-order returns only.|الإرجاع متاح للطلب بالكامل فقط.
Refund includes shipping and tax.|المبلغ المسترد يشمل الشحن والضريبة.
Copy private order link|نسخ رابط الطلب الخاص
Copied.|تم النسخ.
Shipment|الشحنة
View tracking|تتبع الشحنة
Back|رجوع
Quick Add|إضافة سريعة
Item|عنصر
Items|عناصر
Overview|نظرة عامة
Features Matrix|مصفوفة الميزات
Planned Features|الميزات المخططة
Verification|التحقق
Verified|تم التحقق
Unverified|غير متحقق
Verify item|التحقق من العنصر
Reset verification|إعادة تعيين التحقق
Scan product barcode|مسح باركود المنتج
Match & Verify Item SKU|مطابقة وفحص رمز المنتج
Warehouse Barcode Scanner & Lookup|ماسح الباركود وفحص المستودع
Scan barcode or type SKU…|امسح الباركود أو اكتب الرمز…
Match|مطابقة
Barcode verification required|التحقق من الباركود مطلوب
All items must be barcode verified before preparing this order|يجب مطابقة باركود جميع العناصر قبل تجهيز الطلب
Hardware Barcode Scanner Ready|ماسح الباركود جاهز
Aim your handheld scanner gun and pull the trigger, or enter SKU below.|وجه ماسح الباركود اليدوي واضغط الزناد، أو أدخل الرمز أدناه.
Scan barcode gun or enter SKU…|امسح بماسح الباركود أو اكتب الرمز…
Scan another product|مسح منتج آخر
Product code|رمز المنتج
Authenticity verified|أصالة معتمدة
System status|حالة النظام
Check status|فحص الحالة
Store server|خادم المتجر
Working normally|يعمل بصورة طبيعية
Store database|قاعدة بيانات المتجر
Live stock updates|تحديثات فورية للمخزون
Real-time|لحظي
Last checked|آخر فحص
Store theme & style|مظهر وتصميم المتجر
Choose a color style for your store.|اختر نمط الألوان المناسب لمتجرك.
Click any color palette above to preview how your store looks.|انقر فوق أي لوحة ألوان لمعاينة مظهر المتجر.
Store details|تفاصيل المتجر
Setting|الإعداد
Value|القيمة
Store features|ميزات المتجر
Feature|الميزة
Store Status|حالة المتجر
Website Display|عرض الموقع
Supported|مدعوم
Online card payment|الدفع بالبطاقة البنكية
Product serial tracking|تتبع الأرقام التسلسلية للمنتج
Saved customer addresses|عناوين العملاء المحفوظة
Activity history|سجل النشاط
Staff|فريق العمل
Event|الحدث
System|النظام
All store activities and order updates will appear here.|ستظهر جميع أنشطة المتجر وتحديثات الطلبات هنا.
Currency|العملة
Language|اللغة
Product not found|المنتج غير موجود
This product may have been archived or is no longer available.|ربما تمت أرشفة هذا المنتج أو لم يعد متوفراً.
Back to shop|العودة للمتجر
Fast shipping|شحن سريع
Secure checkout|دفع آمن
Quality guaranteed|جودة مضمونة
Switch currency|تغيير العملة
Switch language|تغيير اللغة
`.trim().split('\n').map(line => line.split('|')))
};

export function translate(key, language = 'en') {
  if (language === 'ar') {
    return dictionary.ar[key] || key;
  }
  return key;
}

export const t = translate;

export function getDirection(language) {
  return language === 'ar' ? 'rtl' : 'ltr';
}
