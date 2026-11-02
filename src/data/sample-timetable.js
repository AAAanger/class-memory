// ============================================================
//  示例课表（虚构，仅供演示 / 测试）
//
//  这份数据的格式和「识别课表截图」返回的完全一样，
//  所以它走的是同一条导入流水线。
//
//  特意保留了现实中会遇到的几种坑，用来自证解析层是对的：
//    1. 同一门课在不同周次换时间（数据结构：1-2 周在周一/周二，5-12 周转到周五）
//    2. 单双周（大学英语 1-16 周只上单周）
//    3. 同一个时段里，不同周次是不同的课（周三 5-6 节：1-14 周是组成原理，15-16 周变成课程设计）
//    4. 有些课只在最后几周才上（程序设计基础第 17 周才补一次）
// ============================================================

export const SAMPLE_TIMETABLE = {
  source: '示例课表 · 计算机专业大二（虚构，仅用于演示）',
  entries: [
    // ---------- 第 1-2 节（08:20–09:50） ----------
    { course: '高等数学A', teacher: '张明', weekday: 1, periods: [1, 2], weeks: '1-16', room: '教一-201' },
    { course: '大学英语', teacher: '王芳', weekday: 2, periods: [1, 2], weeks: '1-16', room: '外语楼-102' },
    { course: '计算机组成原理', teacher: '周涛', weekday: 3, periods: [1, 2], weeks: '1-14', room: '教二-305' },
    { course: '大学体育', teacher: '陈刚', weekday: 4, periods: [1, 2], weeks: '1-3,5-16', room: '体育馆' },
    { course: '程序设计基础', teacher: '刘伟', weekday: 5, periods: [1, 2], weeks: '1-8', room: '机房-401' },

    // ---------- 第 3-4 节（10:15–11:45） ----------
    { course: '数据结构与算法', teacher: '赵磊', weekday: 1, periods: [3, 4], weeks: '1-2', room: '教一-203' },
    { course: '程序设计基础', teacher: '刘伟', weekday: 1, periods: [3, 4], weeks: '17', room: '机房-401' },
    { course: '数据结构与算法', teacher: '赵磊', weekday: 2, periods: [3, 4], weeks: '1-4,9-10,14-16', room: '教三-108' },
    { course: '高等数学A', teacher: '张明', weekday: 3, periods: [3, 4], weeks: '1-16', room: '教一-201' },
    { course: '线性代数', teacher: '孙丽', weekday: 4, periods: [3, 4], weeks: '1-12', room: '教一-105' },
    { course: '计算机网络', teacher: '郑凯', weekday: 5, periods: [3, 4], weeks: '1-12', room: '教二-210' },

    // ---------- 第 5-6 节（13:50–15:20） ----------
    { course: '数据库原理', teacher: '杨帆', weekday: 1, periods: [5, 6], weeks: '1-10', room: '教二-306' },
    { course: '大学英语', teacher: '王芳', weekday: 2, periods: [5, 6], weeks: '1-16 单', room: '外语楼-102' },
    { course: '形势与政策', teacher: '黄倩', weekday: 2, periods: [5, 6], weeks: '8,10', room: '教一-101' },
    { course: '计算机组成原理', teacher: '周涛', weekday: 3, periods: [5, 6], weeks: '1-14', room: '教二-305' },
    { course: '计算机组成原理课程设计', teacher: '周涛', weekday: 3, periods: [5, 6], weeks: '15-16', room: '教二-305' },
    { course: '数据结构与算法', teacher: '赵磊', weekday: 5, periods: [5, 6], weeks: '5-12,14', room: '教三-108' },
    { course: '计算机网络', teacher: '郑凯', weekday: 5, periods: [5, 6], weeks: '13', room: '教二-210' },

    // ---------- 第 7-8 节（15:40–17:10） ----------
    { course: '操作系统', teacher: '吴敏', weekday: 1, periods: [7, 8], weeks: '1-12', room: '教三-201' },
    { course: '计算机网络', teacher: '郑凯', weekday: 2, periods: [7, 8], weeks: '1-12', room: '教二-210' },
    { course: '操作系统', teacher: '吴敏', weekday: 4, periods: [7, 8], weeks: '1-12', room: '教三-201' },
    { course: '线性代数', teacher: '孙丽', weekday: 5, periods: [7, 8], weeks: '13-16', room: '教一-105' },

    // ---------- 第 9-10 节（17:45–19:15） ----------
    { course: '大学体育', teacher: '陈刚', weekday: 2, periods: [9, 10], weeks: '14-15', room: '体育馆' },
    { course: '程序设计基础', teacher: '刘伟', weekday: 3, periods: [9, 10], weeks: '9-16', room: '机房-401' },
    { course: '数据库原理', teacher: '杨帆', weekday: 4, periods: [9, 10], weeks: '1-10', room: '教二-306' },

    // ---------- 第 11-12 节（19:30–21:00） ----------
    { course: '形势与政策', teacher: '黄倩', weekday: 1, periods: [11, 12], weeks: '15-16', room: '教一-101' },
    { course: '数据库原理', teacher: '杨帆', weekday: 4, periods: [11, 12], weeks: '11-12', room: '教二-306' },
  ],
};
