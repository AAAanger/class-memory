// ============================================================
//  数据存在哪：浏览器的 IndexedDB（相当于手机里的一个本地数据库）
//  一共有 5 张表：
//    courses   课程（名字 + 颜色）
//    slots     课表时段（星期几、几点到几点、第几周）
//    photos    照片的「信息」（不含图片本身，列表加载就快了）
//    assets    照片的「图片本身」（大图 + 缩略图）
//    settings  设置项
// ============================================================

import { openDB } from 'idb';

const DB_NAME = 'class-memory';
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('courses')) {
      db.createObjectStore('courses', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('slots')) {
      const store = db.createObjectStore('slots', { keyPath: 'id' });
      store.createIndex('courseId', 'courseId');
    }
    if (!db.objectStoreNames.contains('photos')) {
      const store = db.createObjectStore('photos', { keyPath: 'id' });
      store.createIndex('courseId', 'courseId');
      store.createIndex('sessionKey', 'sessionKey');
      store.createIndex('day', 'day');
    }
    if (!db.objectStoreNames.contains('assets')) {
      db.createObjectStore('assets', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  },
});

/* ---------- 设置项 ---------- */

export async function getSetting(key, fallback = null) {
  const db = await dbPromise;
  const row = await db.get('settings', key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = await dbPromise;
  await db.put('settings', { key, value });
}

/* ---------- 课程 ---------- */

export async function allCourses() {
  return (await (await dbPromise).getAll('courses')).sort((a, b) => a.createdAt - b.createdAt);
}

export async function putCourse(course) {
  await (await dbPromise).put('courses', course);
}

export async function deleteCourse(id) {
  const db = await dbPromise;
  const tx = db.transaction(['courses', 'slots'], 'readwrite');
  await tx.objectStore('courses').delete(id);
  const slots = await tx.objectStore('slots').index('courseId').getAll(id);
  for (const s of slots) await tx.objectStore('slots').delete(s.id);
  await tx.done;
}

/* ---------- 课表时段 ---------- */

export async function allSlots() {
  return (await (await dbPromise).getAll('slots')).sort(
    (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
  );
}

export async function putSlot(slot) {
  await (await dbPromise).put('slots', slot);
}

export async function deleteSlot(id) {
  await (await dbPromise).delete('slots', id);
}

/** 批量写入课程 + 时段（识别课表后一次性导入），要么全成要么全不成 */
export async function importTimetable({ courses = [], slots = [] }) {
  const db = await dbPromise;
  const tx = db.transaction(['courses', 'slots'], 'readwrite');
  for (const course of courses) await tx.objectStore('courses').put(course);
  for (const slot of slots) await tx.objectStore('slots').put(slot);
  await tx.done;
}

/* ---------- 照片 ---------- */

export async function allPhotos() {
  return (await (await dbPromise).getAll('photos')).sort((a, b) => b.takenAt - a.takenAt);
}

export async function photosByDay(day) {
  return (await dbPromise).getAllFromIndex('photos', 'day', day);
}

/** 同时写入信息和图片本身，要么都成功，要么都不落库 */
export async function putPhoto(photo, assets) {
  const db = await dbPromise;
  const tx = db.transaction(['photos', 'assets'], 'readwrite');
  await tx.objectStore('photos').put(photo);
  await tx.objectStore('assets').put({ id: photo.id, ...assets });
  await tx.done;
}

/** 只改信息（比如手动改归属课程），不动图片 */
export async function updatePhoto(photo) {
  await (await dbPromise).put('photos', photo);
}

export async function deletePhoto(id) {
  const db = await dbPromise;
  const tx = db.transaction(['photos', 'assets'], 'readwrite');
  await tx.objectStore('photos').delete(id);
  await tx.objectStore('assets').delete(id);
  await tx.done;
}

export async function getAsset(id) {
  return (await dbPromise).get('assets', id);
}

/* ---------- 维护 ---------- */

export async function clearAllData() {
  const db = await dbPromise;
  const tx = db.transaction(['courses', 'slots', 'photos', 'assets'], 'readwrite');
  await Promise.all([
    tx.objectStore('courses').clear(),
    tx.objectStore('slots').clear(),
    tx.objectStore('photos').clear(),
    tx.objectStore('assets').clear(),
  ]);
  await tx.done;
}

/** 向浏览器申请「持久化存储」，降低被系统清理的风险 */
export async function requestPersist() {
  if (navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

/** 当前已用多少字节 */
export async function storageUsage() {
  if (navigator.storage?.estimate) {
    const { usage = 0 } = await navigator.storage.estimate();
    return usage;
  }
  return 0;
}
