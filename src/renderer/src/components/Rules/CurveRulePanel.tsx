import React, { FC, useEffect, useState } from 'react'
import Decimal from 'decimal.js'
import type { CurveRule, CurvePoint, SheetData } from '../../../../shared/types'

interface CurveRulePanelProps {
  headers: string[]
  curveRules: CurveRule[]
  sheetData: SheetData | null
  resultData: any
  setResultData: any
  onCurveRulesChange: (rules: CurveRule[]) => void
}

const CurveRulePanel:FC<CurveRulePanelProps>= (props) => {

  const { sheetData, setResultData} = props;
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  // resultMap 存储所有子表（rows + headers）
  const [resultMap, setResultMap] = useState<Map<string, { rows: Record<string, unknown>[], headers: string[] }>>(new Map())
  // 当前选中的子表 key
  const [selectedKey, setSelectedKey] = useState<string>('')
  // 增加淹没线的表头
  const [newHeaders, setNewHeaders] = useState<string[]>(sheetData?.headers ?? [])

  // sheetData 变化时重置 headers
  useEffect(() => {
    setNewHeaders(sheetData?.headers ?? [])
  }, [sheetData])

  useEffect(()=>{
    console.log('初始数据：', sheetData);
    
  }, [sheetData])

  /**
   * 计算不同维度、不同水位线的淹没线
   */
  const handleComputing = ()=>{
    // 1.区分维度和水位线
    const curveMap = new Map();
    if(sheetData && sheetData.headers && sheetData.headers.length > 0){
      sheetData.headers.forEach((item, index)=>{
        if(item.includes('_')){
          const a = item.split('_');
          if(!curveMap.has(a[1]) && a[1]!=='天然水面线'){
            curveMap.set(a[1], [a[0]])
          }else if(a[1] !== '天然水面线'){
            curveMap.set(a[1], [...curveMap.get(a[1]), a[0]])
          }
        }
      })
      console.log('回水线列表：', curveMap);
    }
    // 拆分成不同回水线的子表
    const resultMap = new Map();
    // 记录矩阵数据
    if(sheetData && sheetData.rows && sheetData.rows.length > 0){
      // 1.计算差值： 天然水面线-回水线
      curveMap.forEach((value, key) =>{
        console.log('各个回水线的维度', value, key, sheetData?.headers);
        // 去掉不是这个回水线的列
        const curveData:any[] = sheetData?.rows.map(item => ({ ...item }));
        const headers = sheetData?.headers.map(item=>item).filter((item:any)=>
          !item.includes('_') || (item.includes('_')&&(item.split('_')[1] === key || item.split('_')[1] ==='天然水面线')));
        console.log('回水线初始表：', curveData, '初始表头:', headers)
        const calates:any = [];
        // 回水位的值
        const bases:any = [];
        value.forEach((val:any)=>{
          // console.log(key, ', ', val)
          // 天然水面线
          const base:any[] = curveData.map(item=>item[val+'_天然水面线'])
          // console.log('天然水面线 列:', base);
          // 回水线
          const target:any[] = curveData.map(item=>item[val+'_'+key])
          // console.log(key+'_'+val, '目标列:', target);
          // 1.计算差值
          const spliceArr:any = [];
          for(var i = 0; i < target.length && i < base.length; i++){
            if(base[i] && !isNaN(base[i]) && target[i] && !isNaN(target[i])){
              spliceArr.push(normalizeCell(target[i]-base[i]))
            }
          }
          // 2.查找0.3的区间位置 （是否存在多个0.3的区间）
          let index: number = 0;
          for(var i =0; i<spliceArr.length-1; i++){
            if((spliceArr[i] < 0.3 && spliceArr[i+1] >0.3) || (spliceArr[i] > 0.3 && spliceArr[i+1] <0.3)){
              index = i+1;
              break;
            }
          }
          // 在index的位置插入计算出的x\y\z
          if(index){
            // 回水末端前一个断面距坝里程
            let S1 = curveData[index-1]['距坝里程'];
            // 回水末端后一个断面距坝里程
            let S2 = curveData[index]['距坝里程'];
            // 回水末端前一个断面天然水位
            let a = curveData[index-1][val+'_天然水面线'];
            // 回水末端后一个断面天然水位
            let A = curveData[index][val+'_天然水面线'];
            // 回水末端前一个断面回水位
            let b = curveData[index-1][val+'_'+key];
            // 回水末端后一个断面回水位
            let B = curveData[index][val+'_'+key];
            // 计算回水末端结果
            // console.log(Number(S1), Number(S2), Number(a), Number(A), Number(b), Number(B))
            const res = calculateEnd(Number(S1), Number(S2), Number(a), Number(A), Number(b), Number(B))
            // 可以改成按照表头渲染字段属性
            const result: Record<string, unknown> = {
              '距坝里程': res[2],
              '断面号': val+'末端断面',
              [val+'_天然水面线']: res[0],
              [val+'_'+key]: res[1],
            }
            bases.push(res[1]);
            calates.push({
              id: index,
              result
            });
          }
        })
        // 根据距坝里程插入原表
        // 按照result['距坝里程'] 插入（先排序，再逐个 findIndex 插入，避免 splice 导致下标错位）
        const sortedCalates = [...calates].sort((a: any, b: any) => Number(a.result['距坝里程']) - Number(b.result['距坝里程']))
        sortedCalates.forEach((res: any) => {
          const idx = curveData.findIndex((item: any) => Number(item['距坝里程']) > Number(res.result['距坝里程']))
          if (idx !== -1) {
            curveData.splice(idx, 0, res.result)
          } else {
            curveData.push(res.result)
          }
        })
        // console.log('第一阶段回水末端插入列表：', curveData);
        // 计算回水终点，并插入原表
        const finishList:any = [];
        value.forEach((val:any, index:number)=>{
           // 回水位
          const B = bases[index];
          console.log('回水位：', B, val);
          let S1;
          let S2;
          let t;
          let T;
          let pointIndex;
          for(var i =0; i < curveData.length-1; i++){
            // 回水线位于多年平均水面线的位置
            if(curveData[i]['多年平均水面线'] <= B && curveData[i+1]['多年平均水面线'] > B) {
              S1 = curveData[i]['距坝里程'];
              t = curveData[i]['多年平均水面线'];
              S2 = curveData[i+1]['距坝里程'];
              T = curveData[i+1]['多年平均水面线'];
              pointIndex = i+1;
              console.log('回水终点插入位置：', pointIndex)
              break;
            }
          }
          // 回水终点（t/T 精度对齐在 calculateFinish 内部处理）
          const finish = calculateFinish(S1, S2, B, t, T);
          const result = {
            '距坝里程': finish,
            '断面号': val+'处理终点',
            "多年平均水面线": B,
          }
          finishList.push({
            id: pointIndex,
            result: result
          })
        })
        // 按照result['距坝里程'] 插入
        const sortedFinishList = [...finishList].sort((a: any, b: any) => Number(a.result['距坝里程']) - Number(b.result['距坝里程']))
        sortedFinishList.forEach((res: any) => {
          const idx = curveData.findIndex((item: any) => Number(item['距坝里程']) > Number(res.result['距坝里程']))
          if (idx !== -1) {
            curveData.splice(idx, 0, res.result)
          } else {
            curveData.push(res.result)
          }
        })
        console.log('第二阶段回水终点插入列表：', curveData);
        // 增加淹没线
        value.forEach((val:any, index:number)=>{
          const headerName = val+'_淹没线';
          console.log('淹没线列名：', headerName, index);
           // 回水线
          const origin:any[] = curveData.map(item=>item[val+'_'+key])
          console.log(key+'_'+val, '回水线列:', origin);
          const num = val === '0.05'? 1:0.5;
          const base = Number(key) + num;
          console.log('基数值：', base);
          const target: any = origin.map(item => {
            if (item != null && item !== '-' && !isNaN(item)) {
              return base > item ? base : item
            }
            return undefined
          })
          console.log('原表头：', headers);
          const spliceIndex = headers.findIndex(item=> item === val+'_天然水面线')
          console.log('淹没线：', target, spliceIndex, index);
          // 只在 headers 副本中插入，避免污染原始 headers 导致后续 findIndex 偏移
          if (!headers.includes(headerName)) {
            headers.splice(spliceIndex + 2, 0 , headerName);
          }
          let flag = false;
          console.log('结束表示：', val+'末端断面')
          for(var i = 0; i < curveData.length; i++){
            // 大于末端断面时取末端断面
            
            if(target[i]){
              curveData[i][headerName] = target[i] < bases[index] ? target[i]:bases[index]
            }else if(flag){
              if(!(curveData[i]['断面号'] as string).includes('末端断面') && !(curveData[i]['断面号'] as string).includes('处理终点')){
                curveData[i][headerName] = bases[index]
              }
            }
            if(curveData[i]['断面号'] === val+'末端断面'){
              flag = true
            }
            // 到处理终点截止，不再赋值
            if(curveData[i]['断面号'] === val + '处理终点'){
              curveData[i][headerName] = bases[index]
              console.log('结束：', curveData[i])
              break;
            }
          }
        })
        // 以回水线分割为子表
        resultMap.set(key, { rows: curveData, headers: [...(headers ?? [])] })
      })
      // 保存结果并默认选中第一个子表
      setResultMap(new Map(resultMap))
      const firstKey = resultMap.keys().next().value
      if (firstKey) {
        setSelectedKey(firstKey)
        setPreviewRows(resultMap.get(firstKey)?.rows ?? [])
        setNewHeaders(resultMap.get(firstKey)?.headers ?? [])
      }
      // 同步到父组件 resultData，供导出使用
      const multiSheetData = {
        sheets: Array.from(resultMap.entries()).map(([key, val]) => ({
          name: `回水线_${key}`,
          headers: val.headers,
          rows: val.rows
        }))
      }
      setResultData(multiSheetData)
    }

  }

  const normalizeCell = (val: unknown, bit = 2) => {
  if (typeof val === 'number') {
    return parseFloat(val.toFixed(bit))
  }
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
    return parseFloat(Number(val).toFixed(bit))
  }
  return val
}
  /**
   * 回水末端
   */
  const calculateEnd = (S1: number, S2: number, a: number, A: number, b: number, B: number): [number, number, number] => {
    const dS1 = new Decimal(S1), dS2 = new Decimal(S2);
    const da = new Decimal(a), dA = new Decimal(A);
    const db = new Decimal(b), dB = new Decimal(B);

    const e1 = dS2.minus(dS1);
    const e2 = dA.minus(da);
    const e3 = dB.minus(db);
    const t1 = e2.div(e1);
    const t2 = e3.div(e1);
    const x = db.minus(da).minus(0.3).div(t1.minus(t2));
    const A1 = t1.mul(x).plus(da).toDecimalPlaces(3).toNumber();
    const B1 = t2.mul(x).plus(db).toDecimalPlaces(3).toNumber();
    const X = x.plus(dS1).toDecimalPlaces(2).toNumber();
    return [A1, B1, X];
  }

  /**
   * 回水终点
   */
  const calculateFinish = (S1: number, S2: number, B: number, t: number, T: number): number => {
    // 输入 t/T 对齐 Excel 显示精度（2位小数）
    const dS1 = new Decimal(S1), dS2 = new Decimal(S2);
    const dB = new Decimal(B);
    console.log(dB.toNumber())
    // const dt = new Decimal(new Decimal(t).toDecimalPlaces(6));
    const dt = new Decimal(t);
    // const dT = new Decimal(new Decimal(T).toDecimalPlaces(6));
    const dT = new Decimal(T)
    const e1 = dS2.minus(dS1);
    console.log('s1-s2:', e1.toNumber());
    const e2 = dT.minus(dt);
    console.log(dt.toNumber(), dT.toNumber(), 't-T:', e2.toNumber());
    const m = e2.div(e1);
    console.log('m:', m.toNumber());
    const x = dB.minus(dt).div(m);
    console.log('x:', x.toNumber());
    const X = x.plus(dS1).toDecimalPlaces(2).toNumber();
    console.log('结果：', X, '验证：', m.mul(x).plus(dt).toNumber());
    return X;
  }

  return (
    <>
      <div>

        <button onClick={handleComputing} style={styles.calcBtn}>
          📥 计算
        </button>
      </div>

      {resultMap.size > 0 && (
        <div style={styles.selectorRow}>
          <label style={styles.selectorLabel}>预览子表：</label>
          <select
            style={styles.selector}
            value={selectedKey}
            onChange={(e) => {
              const key = e.target.value
              setSelectedKey(key)
              setPreviewRows(resultMap.get(key)?.rows ?? [])
              setNewHeaders(resultMap.get(key)?.headers ?? [])
            }} 
          >
            {Array.from(resultMap.keys()).map((key) => (
              <option key={key} value={key}>
                回水线 {key}（{resultMap.get(key)?.rows?.length ?? 0} 行）
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={styles.container}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {newHeaders?.map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  {newHeaders?.map((h) => (
                    <td key={h} style={styles.td}>
                      {row[h] == null ? '' : String(row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={styles.hint}>
          预览前 {previewRows.length} 行，共 {sheetData?.rows.length} 行 · {newHeaders?.length} 列
        </div>
      </div>
    </>
  )
}

export default CurveRulePanel;

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 4 },
  calcBtn: { padding: '6px 16px', cursor: 'pointer', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, marginBottom: 8 },
  selectorRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  selectorLabel: { fontSize: 13, color: '#555', whiteSpace: 'nowrap' },
  selector: { padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', minWidth: 180 },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 4 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { background: '#e6f4ff', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' },
  td: { padding: '4px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' },
  rowEven: { background: '#fff' },
  rowOdd: { background: '#fafafa' },
  hint: { fontSize: 12, color: '#888', padding: '2px 4px' },
  empty: { color: '#aaa', fontSize: 14, padding: '20px 0', textAlign: 'center' }
}

function genId(): string {
  return Math.random().toString(36).slice(2)
}

function defaultPoints(): CurvePoint[] {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 100 }
  ]
}

