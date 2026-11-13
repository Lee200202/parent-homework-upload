/** 南一國中數學六冊目錄。來源與核對日期見 docs/curriculum-sources.md。 */
const NANYI = {
  '7-1': [
    ['整數運算與科學記號', [['1-1','數與數線'],['1-2','整數的加減運算'],['1-3','整數的乘除運算'],['1-4','指數記法與科學記號']]],
    ['因數分解與分數運算', [['2-1','質因數分解'],['2-2','公因數與公倍數'],['2-3','分數的四則運算'],['2-4','指數律']]],
    ['一元一次方程式', [['3-1','以符號列式與運算'],['3-2','一元一次方程式的列式與求解'],['3-3','一元一次方程式的應用']]]
  ],
  '7-2': [
    ['生活中的幾何圖形', [['1-1','幾何圖形、線對稱與三視圖']]],
    ['二元一次聯立方程式', [['2-1','二元一次方程式'],['2-2','解二元一次聯立方程式'],['2-3','二元一次聯立方程式的應用']]],
    ['平面直角坐標系', [['3-1','直角坐標平面'],['3-2','二元一次方程式的圖形']]],
    ['比例', [['4-1','比例式'],['4-2','正比與反比']]],
    ['一元一次不等式', [['5-1','一元一次不等式及其解'],['5-2','解一元一次不等式及其應用']]],
    ['統計圖表與資料分析', [['6-1','統計圖表'],['6-2','資料分析']]]
  ],
  '8-1': [
    ['乘法公式與多項式', [['1-1','乘法公式'],['1-2','多項式的加法與減法'],['1-3','多項式的乘法與除法']]],
    ['平方根與畢氏定理', [['2-1','平方根與近似值'],['2-2','根式的運算'],['2-3','畢氏定理']]],
    ['因式分解', [['3-1','提公因式法與乘法公式因式分解'],['3-2','利用十字交乘法因式分解']]],
    ['一元二次方程式', [['4-1','因式分解法解一元二次方程式'],['4-2','配方法與一元二次方程式的公式解'],['4-3','一元二次方程式的應用']]],
    ['統計資料處理與圖表', [['5-1','相對與累積次數分配圖表']]]
  ],
  '8-2': [
    ['數列與等差級數', [['1-1','等差數列'],['1-2','等差級數'],['1-3','等比數列']]],
    ['函數及其圖形', [['2-1','一次函數及函數圖形與應用']]],
    ['三角形的性質與尺規作圖', [['3-1','內角與外角'],['3-2','基本尺規作圖'],['3-3','三角形全等'],['3-4','全等三角形的應用'],['3-5','三角形的邊角關係']]],
    ['平行與四邊形', [['4-1','平行線'],['4-2','平行四邊形'],['4-3','特殊的四邊形']]]
  ],
  '9-1': [
    ['比例線段與相似形', [['1-1','連比'],['1-2','比例線段'],['1-3','相似形'],['1-4','相似形的應用']]],
    ['圓的性質', [['2-1','圓形及點、直線與圓之間的關係'],['2-2','弧與圓周角']]],
    ['推理證明與三角形的心', [['3-1','推理與證明'],['3-2','三角形的外心、內心與重心']]]
  ],
  '9-2': [
    ['二次函數', [['1-1','二次函數及其圖形'],['1-2','二次函數的最大值或最小值']]],
    ['統計與機率', [['2-1','統計數據的分布'],['2-2','機率']]],
    ['立體幾何圖形', [['3-1','柱體、錐體、空間中的線與平面']]]
  ]
};

function schoolContext_(student, date) {
  const parts = Utilities.formatDate(date || new Date(), 'Asia/Taipei', 'yyyy-MM-dd').split('-').map(Number);
  const year = parts[0], month = parts[1];
  // 依管理者要求：每年 7/1 提前升級並切換上學期；2/1 切換下學期。
  const academicYear = month >= 7 ? year : year - 1;
  const rawGrade = student.baseGrade + academicYear - student.baseAcademicYear;
  const grade = Math.max(7, Math.min(9, rawGrade));
  const semester = rawGrade > 9 ? 2 : (month >= 2 && month < 7 ? 2 : 1);
  const gradeName = {7:'國一',8:'國二',9:'國三'}[grade];
  return { grade: grade, semester: semester, academicYear: academicYear,
    termKey: grade + '-' + semester, termLabel: gradeName + (semester === 1 ? '上' : '下'),
    course: gradeName + '數學', graduated: rawGrade > 9 };
}

function studentConfig_(student, date) {
  const context = schoolContext_(student, date);
  const publisher = student.publisher || 'nanyi';
  const catalog = {nanyi:NANYI,kangxuan:KANGXUAN,hanlin:HANLIN}[publisher];
  const rules = student.deadlines || defaultDeadlines_();
  return { id: student.id, name: student.name, greetingName: student.greetingName,
    course: context.course, termKey: context.termKey, termLabel: context.termLabel,
    publisher: publisher, publisherName: PUBLISHERS[publisher],
    deadlines: {homework:nextDeadline_(rules.homework,date),exam:nextDeadline_(rules.exam,date)},
    graduated: context.graduated, terms: [1, 2].map(function(semester) {
      const key = context.grade + '-' + semester;
      const label = {7:'國一',8:'國二',9:'國三'}[context.grade] + (semester === 1 ? '上' : '下');
      return { key: key, label: label, chapters: catalog[key] };
    }) };
}
