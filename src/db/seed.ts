import { db, uid, BOOK_ID, type Tx, type Category, type Account } from './schema';

/* 确定性伪随机（种子），保证演示数据每次生成一致 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/* ============ 分类树 ============ */
const EXPENSE_TREE: Array<[string, string, string[]]> = [
  ['食品酒水', '🍜', ['早午晚餐', '烟酒茶', '水果零食']],
  ['行车交通', '🚗', ['公共交通', '打车租车', '私家车费用']],
  ['居家物业', '🏠', ['日常用品', '水电煤气', '房租', '物业管理', '维修保养']],
  ['交流通讯', '📱', ['座机费', '手机费', '上网费', '邮寄费']],
  ['衣服饰品', '👕', ['衣服裤子', '鞋帽包包', '化妆饰品']],
  ['休闲娱乐', '🎮', ['运动健身', '交际聚会', '休闲玩乐', '宠物宝贝', '旅游度假']],
  ['医疗保健', '🏥', ['药品费', '保健费', '美容费', '治疗费']],
  ['学习进修', '📚', ['数码装备', '书报杂志', '培训进修']],
  ['人情往来', '🎁', ['送礼请客', '孝敬长辈', '还人钱物', '慈善捐助']],
  ['金融保险', '🏦', ['银行手续', '投资亏损', '按揭还款', '消费税收', '利息支出', '赔偿罚款']],
  ['其他杂项', '📦', ['其他支出', '意外丢失', '烂账损失']],
];
const INCOME_TREE: Array<[string, string, string[]]> = [
  ['职业收入', '💼', ['工资收入', '加班收入', '奖金收入']],
  ['其他收入', '💰', ['兼职收入', '投资收益', '红包礼金', '退款']],
];

export const SEED_FLAG = 'qz_seed_v5';

/** 首次初始化：没有标记就重建（可自愈历史脏数据：有账本但无流水） */
export async function seedIfEmpty() {
  if (localStorage.getItem(SEED_FLAG) === '1' && (await db.txs.count()) > 0) return;
  if (localStorage.getItem(SEED_FLAG) === '1' && (await db.books.count()) > 0) return;
  await doSeed();
  localStorage.setItem(SEED_FLAG, '1');
}

export function markSeeded() {
  localStorage.setItem(SEED_FLAG, '1');
}

async function doSeed() {
  await clearAllData();
  const nowMs = Date.now();
  const now = new Date(nowMs);

  await db.books.add({ id: BOOK_ID, name: '标准账本1', cover: '📔', createdAt: nowMs });

  await db.members.bulkAdd([
    { id: uid(), bookId: BOOK_ID, name: '我', role: 'OWNER', status: 'JOINED', isHidden: 0, sort: 0 },
    { id: uid(), bookId: BOOK_ID, name: '家人', role: 'MEMBER', status: 'JOINED', isHidden: 0, sort: 1 },
  ]);

  /* 分类 */
  const cats: Category[] = [];
  const catId: Record<string, string> = {};
  const push = (name: string, icon: string, type: 'EXPENSE' | 'INCOME', parentId: string | null, sort: number, parentName?: string) => {
    const id = uid();
    catId[(parentName ?? '') + '|' + name] = id;
    cats.push({ id, bookId: BOOK_ID, parentId, name, icon, type, sort, isHidden: 0 });
    return id;
  };
  let s = 0;
  for (const [name, icon, subs] of EXPENSE_TREE) {
    const pid = push(name, icon, 'EXPENSE', null, s++);
    subs.forEach((n, i) => push(n, '', 'EXPENSE', pid, i, name));
  }
  s = 0;
  for (const [name, icon, subs] of INCOME_TREE) {
    const pid = push(name, icon, 'INCOME', null, s++);
    subs.forEach((n, i) => push(n, '', 'INCOME', pid, i, name));
  }
  await db.categories.bulkAdd(cats);

  /* 账户 */
  const accounts: Account[] = [
    { id: uid(), bookId: BOOK_ID, name: '微信钱包', icon: '💬', type: 'WECHAT', isLiability: 0, initBalance: 6200, includeInAssets: 1, isHidden: 0, sort: 0 },
    { id: uid(), bookId: BOOK_ID, name: '支付宝', icon: '🅰️', type: 'ALIPAY', isLiability: 0, initBalance: 6500, includeInAssets: 1, isHidden: 0, sort: 1 },
    { id: uid(), bookId: BOOK_ID, name: '现金', icon: '💵', type: 'CASH', isLiability: 0, initBalance: 860, includeInAssets: 1, isHidden: 0, sort: 2 },
    { id: uid(), bookId: BOOK_ID, name: '工资卡', icon: '💳', type: 'BANK', isLiability: 0, initBalance: 32000, includeInAssets: 1, isHidden: 0, sort: 3 },
    { id: uid(), bookId: BOOK_ID, name: '信用卡', icon: '🧾', type: 'CREDIT', isLiability: 1, initBalance: 0, includeInAssets: 1, isHidden: 0, sort: 4 },
  ];
  await db.accounts.bulkAdd(accounts);
  const acc = (name: string) => accounts.find(a => a.name === name)!.id;

  const projects = [
    { id: uid(), bookId: BOOK_ID, name: '购物', icon: '🛒', isHidden: 0 as const, sort: 0 },
    { id: uid(), bookId: BOOK_ID, name: '日常', icon: '📅', isHidden: 0 as const, sort: 1 },
    { id: uid(), bookId: BOOK_ID, name: '装修', icon: '🛠️', isHidden: 0 as const, sort: 2 },
    { id: uid(), bookId: BOOK_ID, name: '旅游', icon: '✈️', isHidden: 0 as const, sort: 3 },
    { id: uid(), bookId: BOOK_ID, name: '回家过年', icon: '🧧', isHidden: 0 as const, sort: 4 },
  ];
  await db.projects.bulkAdd(projects);
  const merchants = [
    { id: uid(), bookId: BOOK_ID, name: '电商平台', icon: '🛍️', isHidden: 0 as const, sort: 0 },
    { id: uid(), bookId: BOOK_ID, name: '餐馆', icon: '🍚', isHidden: 0 as const, sort: 1 },
    { id: uid(), bookId: BOOK_ID, name: '超市', icon: '🏪', isHidden: 0 as const, sort: 2 },
    { id: uid(), bookId: BOOK_ID, name: '医院', icon: '🏥', isHidden: 0 as const, sort: 3 },
  ];
  await db.merchants.bulkAdd(merchants);

  const proj = (name: string) => projects.find(p => p.name === name)!.id;
  const merch = (name: string) => merchants.find(m => m.name === name)!.id;

  const C = (name: string, parent?: string) => catId[(parent ?? '') + '|' + name];
  const memList = await db.members.toArray();
  const me = memList.find(m => m.role === 'OWNER')!.id;
  const fam = memList.find(m => m.role === 'MEMBER')?.id ?? me;

  /* ============ 演示流水：上月整月 + 本月至今 ============ */
  const rand = rng(20261106);
  const rr = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const txs: Tx[] = [];
  const add = (
    d: Date, type: Tx['type'], amount: number, categoryName: string,
    parentName: string | undefined, accName: string, remark: string, opts: Partial<Tx> = {}
  ) => {
    const occurred = new Date(d.getFullYear(), d.getMonth(), d.getDate(), rr(7, 22), rr(0, 59));
    txs.push({
      id: uid(), bookId: BOOK_ID, type, amount,
      categoryId: C(categoryName, parentName), accountId: acc(accName),
      memberId: me, occurredAt: occurred.getTime(),
      remark, createdBy: me, createdAt: occurred.getTime(), ...opts,
    });
  };

  for (let back = 1; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const daysInMonth = back === 0 ? now.getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const salary = back === 0 ? 12800 : 12600;
    const y = month.getFullYear(), m = month.getMonth();
    const D = (day: number) => new Date(y, m, day);

    /* 工资（每月10号；若本月还没到10号则记在1号，保证本月有收入） */
    const salaryDay = back === 0 && now.getDate() < 10 ? 1 : 10;
    if (daysInMonth >= salaryDay) {
      add(D(salaryDay), 'INCOME', salary, '工资收入', '职业收入', '工资卡', '月度工资');
      add(D(salaryDay), 'TRANSFER', 6000, '', undefined, '工资卡', '工资转入零花', { toAccountId: acc('微信钱包') });
    }
    /* 固定支出 */
    add(D(1), 'EXPENSE', 1800, '房租', '居家物业', '支付宝', `${m + 1}月房租`);
    if (daysInMonth >= 3) add(D(3), 'EXPENSE', rr(140, 260), '水电煤气', '居家物业', '支付宝', '水电燃气费');
    if (daysInMonth >= 5) add(D(5), 'EXPENSE', 1000, '孝敬长辈', '人情往来', '工资卡', '给爸妈的生活费');
    if (daysInMonth >= 6) add(D(6), 'EXPENSE', 59, '手机费', '交流通讯', '微信钱包', '话费充值');

    /* 每日 */
    for (let day = 1; day <= daysInMonth; day++) {
      const d = D(day);
      const wd = d.getDay();
      /* 餐饮 */
      add(d, 'EXPENSE', rr(6, 13), '早午晚餐', '食品酒水', pick(['微信钱包', '支付宝']), '早餐', { merchantId: merch('餐馆'), projectId: proj('日常') });
      add(d, 'EXPENSE', rr(18, 36), '早午晚餐', '食品酒水', pick(['微信钱包', '支付宝']), '午餐', { merchantId: merch('餐馆'), projectId: proj('日常') });
      if (rand() > 0.35) add(d, 'EXPENSE', rr(12, 45), '早午晚餐', '食品酒水', pick(['微信钱包', '现金']), '晚餐', { merchantId: merch('餐馆'), projectId: proj('日常'), memberId: fam });
      /* 交通 */
      add(d, 'EXPENSE', rr(3, 8), '公共交通', '行车交通', pick(['微信钱包', '支付宝']), rand() > 0.5 ? '地铁' : '公交', { projectId: proj('日常') });
      if (rand() > 0.78) add(d, 'EXPENSE', rr(18, 42), '打车租车', '行车交通', '支付宝', '打车', { projectId: proj('日常') });
      /* 每周采购 */
      if (wd === 6 || wd === 0) {
        add(d, 'EXPENSE', rr(25, 65), '水果零食', '食品酒水', '微信钱包', '水果', { merchantId: merch('超市'), projectId: proj('购物') });
        if (rand() > 0.4) add(d, 'EXPENSE', rr(60, 210), '日常用品', '居家物业', '微信钱包', '超市采购', { merchantId: merch('超市'), projectId: proj('购物'), memberId: fam });
      }
      /* 周末娱乐 */
      if ((wd === 6 || wd === 0) && rand() > 0.55) {
        add(d, 'EXPENSE', rr(40, 130), '休闲玩乐', '休闲娱乐', pick(['微信钱包', '信用卡']), pick(['电影', '桌游', '公园周边', '游戏充值']), { projectId: proj('日常') });
      }
      /* 随机 */
      if (rand() > 0.85) add(d, 'EXPENSE', rr(20, 90), '交际聚会', '休闲娱乐', '微信钱包', '和朋友聚会', { merchantId: merch('餐馆') });
      if (rand() > 0.9) add(d, 'EXPENSE', rr(30, 120), '水果零食', '食品酒水', '微信钱包', '下午茶', { merchantId: merch('超市') });
    }
    /* 特殊大额 */
    if (back === 1) {
      add(D(14), 'EXPENSE', 399, '衣服裤子', '衣服饰品', '信用卡', '秋季外套', { merchantId: merch('电商平台'), projectId: proj('购物') });
      add(D(20), 'EXPENSE', 289, '送礼请客', '人情往来', '微信钱包', '朋友聚餐', { merchantId: merch('餐馆') });
      add(D(23), 'EXPENSE', 129, '书报杂志', '学习进修', '支付宝', '技术书两本', { merchantId: merch('电商平台') });
      add(D(26), 'INCOME', 800, '红包礼金', '其他收入', '微信钱包', '生日红包');
    } else {
      if (daysInMonth >= 2) add(D(2), 'EXPENSE', 168, '运动健身', '休闲娱乐', '支付宝', '健身房月卡', { projectId: proj('日常') });
      if (daysInMonth >= 4) add(D(4), 'EXPENSE', 96, '药品费', '医疗保健', '微信钱包', '感冒药', { merchantId: merch('医院') });
    }
  }

  await db.txs.bulkAdd(txs);
}

export async function resetDemoData() {
  await doSeed();
  markSeeded();
}

export async function clearAllData() {
  await Promise.all([db.books.clear(), db.members.clear(), db.categories.clear(), db.accounts.clear(), db.projects.clear(), db.merchants.clear(), db.txs.clear()]);
}
