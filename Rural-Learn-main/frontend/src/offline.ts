// Offline download manager — caches course JSON (all platforms) + PDF/video files (native only)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const COURSE_KEY = (id: string) => `rl_course_${id}`;
const INDEX_KEY = "rl_offline_index";

type OfflineIndex = string[];

export type CachedLesson = any & { localUri?: string };
export type CachedCourse = any & { cachedAt: string; bytes: number };

async function getIndex(): Promise<OfflineIndex> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function setIndex(list: OfflineIndex) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export async function getDownloadedIds(): Promise<string[]> {
  return getIndex();
}

export async function isDownloaded(courseId: string): Promise<boolean> {
  const idx = await getIndex();
  return idx.includes(courseId);
}

export async function getOfflineCourse(courseId: string): Promise<CachedCourse | null> {
  const raw = await AsyncStorage.getItem(COURSE_KEY(courseId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getCourseDir(courseId: string) {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}courses/${courseId}/`;
}

async function ensureCourseDir(courseId: string): Promise<string | null> {
  const dir = getCourseDir(courseId);
  if (!dir) return null;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function downloadFile(url: string, destPath: string): Promise<number> {
  try {
    const res = await FileSystem.downloadAsync(url, destPath);
    const info = await FileSystem.getInfoAsync(res.uri);
    return info.exists ? (info.size || 0) : 0;
  } catch {
    return 0;
  }
}

export async function downloadCourse(
  course: any,
  onProgress?: (pct: number, label: string) => void
): Promise<CachedCourse> {
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  let totalBytes = 0;
  const downloadable = lessons.filter(
    (l: any) => (l.type === "pdf" && l.pdf_url) || (l.type === "video" && l.video_url)
  );
  const total = Math.max(downloadable.length, 1);
  let done = 0;

  onProgress?.(0, "Preparing...");

  const cachedLessons: CachedLesson[] = [];
  const dir = Platform.OS === "web" ? null : await ensureCourseDir(course.id);

  for (const lesson of lessons) {
    const copy: CachedLesson = { ...lesson };
    if (dir) {
      if (lesson.type === "pdf" && lesson.pdf_url) {
        const dest = `${dir}${lesson.id}.pdf`;
        onProgress?.(Math.round((done / total) * 90), `PDF: ${lesson.title}`);
        totalBytes += await downloadFile(lesson.pdf_url, dest);
        copy.localUri = dest;
        done += 1;
      } else if (lesson.type === "video" && lesson.video_url) {
        const dest = `${dir}${lesson.id}.mp4`;
        onProgress?.(Math.round((done / total) * 90), `Video: ${lesson.title}`);
        totalBytes += await downloadFile(lesson.video_url, dest);
        copy.localUri = dest;
        done += 1;
      }
    }
    cachedLessons.push(copy);
  }

  const cached: CachedCourse = {
    ...course,
    lessons: cachedLessons,
    cachedAt: new Date().toISOString(),
    bytes: totalBytes,
  };
  await AsyncStorage.setItem(COURSE_KEY(course.id), JSON.stringify(cached));
  const idx = await getIndex();
  if (!idx.includes(course.id)) {
    idx.push(course.id);
    await setIndex(idx);
  }
  onProgress?.(100, "Done");
  return cached;
}

export async function deleteCourse(courseId: string) {
  await AsyncStorage.removeItem(COURSE_KEY(courseId));
  const idx = (await getIndex()).filter(x => x !== courseId);
  await setIndex(idx);
  const dir = getCourseDir(courseId);
  if (dir) {
    try { await FileSystem.deleteAsync(dir, { idempotent: true }); } catch {}
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
