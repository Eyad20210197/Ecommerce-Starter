export const starterCategories = [
  { id: 'cat-everyday', name: 'Everyday Essentials', slug: 'everyday', translations: { ar: 'أساسيات يومية' } },
  { id: 'cat-drinkware', name: 'Drinkware & Bottles', slug: 'drinkware', translations: { ar: 'أواني الشرب والحافظات' } },
  { id: 'cat-accessories', name: 'Accessories & Leather', slug: 'accessories', translations: { ar: 'الإكسسوارات والجلدية' } },
  { id: 'cat-stationery', name: 'Desk & Stationery', slug: 'stationery', translations: { ar: 'المكتب والأدوات الورقية' } }
];

export const starterProducts = [
  {
    id: 'prod-tote-01',
    sku: 'AUR-TOTE-01',
    name: 'Canvas Utility Tote',
    description: 'A heavy-duty cotton canvas tote with reinforced handles, interior zip pocket, and structured bottom.',
    price_minor: 2400,
    category_id: 'cat-everyday',
    category_name: 'Everyday Essentials',
    tags: ['everyday', 'bag', 'cotton', 'sustainable'],
    image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80',
    available: 18,
    active: true,
    serialized: false,
    created_at: '2026-09-01T10:00:00Z',
    translations: {
      ar: {
        name: 'حقيبة قماشية يومية متينة',
        description: 'حقيبة من القماش القطني المتين مع مقابض معززة وجيب داخلي بسحاب وتصميم عملي يومي.'
      }
    }
  },
  {
    id: 'prod-notebook-02',
    sku: 'AUR-NOTE-02',
    name: 'Clothbound Daily Journal',
    description: 'An A5 hardcover journal with 100gsm acid-free ruled paper, ribbon bookmark, and elastic closure.',
    price_minor: 1600,
    category_id: 'cat-stationery',
    category_name: 'Desk & Stationery',
    tags: ['stationery', 'desk', 'paper', 'writing'],
    image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    available: 24,
    active: true,
    serialized: false,
    created_at: '2026-09-02T11:00:00Z',
    translations: {
      ar: {
        name: 'دفتر يوميات قماشي فاخر',
        description: 'دفتر ملاحظات مقاس A5 بغلاف قماشي أنيق وورق عالي الجودة مع شريط لتحديد الصفحات.'
      }
    }
  },
  {
    id: 'prod-bottle-03',
    sku: 'AUR-BTL-03',
    name: 'Insulated Stainless Steel Bottle',
    description: 'Double-wall vacuum insulation keeps cold for 24 hours or hot for 12 hours. BPA-free 750ml capacity.',
    price_minor: 3200,
    category_id: 'cat-drinkware',
    category_name: 'Drinkware & Bottles',
    tags: ['drinkware', 'bottle', 'steel', 'eco'],
    image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
    available: 15,
    active: true,
    serialized: true,
    created_at: '2026-09-03T12:00:00Z',
    translations: {
      ar: {
        name: 'قارورة فولاذية عازلة للحرارة',
        description: 'حافظة سوائل عازلة بتفريغ الهواء المزدوج تحفظ البرودة لمدة 24 ساعة والحرارة لـ 12 ساعة بسعة 750 مل.'
      }
    }
  },
  {
    id: 'prod-wallet-04',
    sku: 'AUR-WLT-04',
    name: 'Handmade Leather Cardholder',
    description: 'Minimalist full-grain vegetable-tanned leather wallet with 4 quick-access slots and cash sleeve.',
    price_minor: 3800,
    category_id: 'cat-accessories',
    category_name: 'Accessories & Leather',
    tags: ['accessories', 'leather', 'wallet', 'handcrafted'],
    image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
    available: 12,
    active: true,
    serialized: true,
    created_at: '2026-09-04T13:00:00Z',
    translations: {
      ar: {
        name: 'محفظة بطاقات جلدية مصنوعة يدوياً',
        description: 'محفظة جلد طبيعي فاخرة مدمجة تحتوي على 4 فتحات للبطاقات وقسم مخصص للنقود.'
      }
    }
  },
  {
    id: 'prod-mug-05',
    sku: 'AUR-MUG-05',
    name: 'Ceramic Studio Coffee Mug',
    description: 'Artisan ceramic mug with a smooth matte exterior and ergonomic comfortable handle. 350ml.',
    price_minor: 1800,
    category_id: 'cat-drinkware',
    category_name: 'Drinkware & Bottles',
    tags: ['drinkware', 'mug', 'ceramic', 'coffee'],
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    available: 20,
    active: true,
    serialized: false,
    created_at: '2026-09-05T14:00:00Z',
    translations: {
      ar: {
        name: 'كوب قهوة سيراميك حرفي',
        description: 'كوب مصنوع يدوياً من السيراميك بلمسة مطفية راقية ومقبض مريح لليد بسعة 350 مل.'
      }
    }
  },
  {
    id: 'prod-cap-06',
    sku: 'AUR-CAP-06',
    name: 'Washed Organic Cotton Cap',
    description: 'Low-profile unstructured six-panel baseball cap in soft organic washed cotton with antique brass buckle.',
    price_minor: 2200,
    category_id: 'cat-everyday',
    category_name: 'Everyday Essentials',
    tags: ['everyday', 'cap', 'cotton', 'apparel'],
    image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=80',
    available: 14,
    active: true,
    serialized: false,
    created_at: '2026-09-06T15:00:00Z',
    translations: {
      ar: {
        name: 'قبعة قطنية عضوية مغسولة',
        description: 'قبعة بيسبول مريحة من القطن العضوي المعالج بنعومة مع مشبك نحاسي أنيق قابل للتعديل.'
      }
    }
  }
];
