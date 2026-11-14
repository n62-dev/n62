// SPDX-License-Identifier: GPL-3.0-or-later
// vrB: which Giac command names does the store path refuse (R281 refuseStore)?
import { refuseStore } from "../../../app/src/input/parseTables.ts";
const names = ["sin","pi","det","trace","max","min","gcd","lcm","mean","rand","solve","factor","diff","int","sum","plot","sqrt","abs","floor","exp","ln","log","median","sort","size","dim","length","rank","inv","ifte","when","subst","expand","simplify","Ans","evalf","approx","seq","cross","dot","norm","im","re","conj","arg","E","rate","A1","binomial","comb","perm","fact","isprime","nextprime","mod","irem","iquo","round","sign","tan","atan2","sinh","asinh","zeros","limit","taylor","series","unit","mksa","usimplify","e","i","x","f","g","degree","coeff","roots","fsolve","nSolve","newton","purge","assume","about","DIGITS","Digits"];
const ok:string[]=[]; const ref:string[]=[];
for (const n of names) { try { refuseStore(n); ok.push(n); } catch (e) { ref.push(n); } }
console.log("ACCEPTED:", ok.join(" ")); console.log("REFUSED:", ref.join(" "));
