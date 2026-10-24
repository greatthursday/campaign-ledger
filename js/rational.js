// Exact rational arithmetic. JSON snapshots use canonical "numerator/denominator" strings.
const gcd = (a,b) => b ? gcd(b,a%b) : a < 0n ? -a : a;
export function q(value) {
  if (Array.isArray(value)) return norm(...value);
  let s=String(value);
  // JS renders very small finite numeric inputs in exponent notation. Expand exactly.
  if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(s)) {
    const [mantissa,exponent]=s.toLowerCase().split('e');
    const [whole,decimal='']=mantissa.split('.');
    const digits=BigInt(whole+decimal);
    const scale=decimal.length-Number(exponent);
    return scale>=0?norm(digits,10n**BigInt(scale)):norm(digits*10n**BigInt(-scale),1n);
  }
  if (/^-?\d+\/[1-9]\d*$/.test(s)) return norm(...s.split('/').map(BigInt));
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('Expected finite decimal or rational');
  const [a,b='']=s.split('.');
  return norm(BigInt(a+b),10n**BigInt(b.length));
}
function norm(n,d) { if(!d) throw new Error('Zero denominator'); if(d<0n){n=-n;d=-d;} const g=gcd(n,d);return [n/g,d/g]; }
export const add=(a,b)=>{a=q(a);b=q(b);return norm(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);};
export const mul=(a,b)=>{a=q(a);b=q(b);return norm(a[0]*b[0],a[1]*b[1]);};
export const div=(a,b)=>{b=q(b);return mul(a,[b[1],b[0]]);};
export const neg=a=>{a=q(a);return [-a[0],a[1]];};
export const cmp=(a,b)=>{a=q(a);b=q(b);const n=a[0]*b[1]-b[0]*a[1];return n<0n?-1:n>0n?1:0;};
export const str=a=>q(a).join('/');
export const number=a=>{a=q(a);return Number(a[0])/Number(a[1]);};
export function round(a,policy='nearest') {
  const [n,d]=q(a); let f=n/d; if(n<0n&&n%d)f--;
  const r=n-f*d;
  const result=policy==='floor'?f:policy==='ceil'?(r?f+1n:f):policy==='nearest'?(2n*r>=d?f+1n:f):null;
  if(result===null)throw new Error('Invalid rounding');
  const v=Number(result);if(!Number.isSafeInteger(v))throw new Error('XP exceeds safe display range');return v;
}
