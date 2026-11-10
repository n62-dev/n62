// SPDX-License-Identifier: GPL-3.0-or-later
// G44 (docs/04 2.3 #2): the inverse distribution functions polished by substituting back. Giac's normald_icdf,
// student_icdf, chisquare_icdf and fisher_icdf return a double at any Digits (normald_icdf(10^-10) is wrong from the
// 8th digit), and so do its forward functions (normald_cdf, student_cdf, …). Our forward functions run at Giac's
// Digits with MPFR: the normal through erfc (our continued fraction in the tail), the others through the regularized incomplete beta and gamma functions,
// by their continued fractions (DLMF 8.17.22, 8.9.2) and series (DLMF 8.7.1), each tail computed directly on its own
// side. From Giac's value x₀, Newton on F(x) = p with the density as the derivative, on the smaller tail, stops when
// the step is below 10^−Digits. The agreement check of docs/04 2.4 rule 2 then runs the polished input at P and P + 20
// (numeric.ts). When an argument is not a real number, Newton does not converge in 20 steps, or the residual
// |F(x) − p|/min(p, 1 − p) is above 10^−digits, the definition returns Giac's value and sets the flag ICDF_FAILED:
// the caller keeps today's ⚠ (the unaudited check). Synchronous, UI-free; only erasable TypeScript syntax.
import type { Giac } from "./numeric.ts";
import { callsOf, closing, functionsIn, renameCalls, withoutStrings, type Quoting } from "./giacPrint.ts";

/** G221 (F195): the forward functions read from pasicdft at Digits, with Giac's aliases (`MODE=raw`). */
const CDF_REPLACED: Readonly<Record<string, string>> = {
  student_cdf: "passtudent_cdf",
  studentd_cdf: "passtudent_cdf",
  chisquare_cdf: "paschisquare_cdf",
  chisquared_cdf: "paschisquare_cdf",
  normald_cdf: "pasnormald_cdf",
  normal_cdf: "pasnormald_cdf",
  UTPN: "pasutpn",
};

/** The Giac names polished, and our definition each call is replaced by. */
export const ICDF_REPLACED: Readonly<Record<string, string>> = {
  normald_icdf: "pasnormald_icdf",
  student_icdf: "passtudent_icdf",
  chisquare_icdf: "paschisquare_icdf",
  fisher_icdf: "pasfisher_icdf",
  // G220 (F195): Giac's alias of normald_icdf, the same arguments.
  normal_icdf: "pasnormald_icdf",
  // G44f1: erf and erfc by our MPFR definitions (below), checked like the inverse functions.
  erf: "paserfv",
  erfc: "paserfcv",
  ...CDF_REPLACED,
};

/** Set to 1 by a polish that fell back to Giac's value. */
export const ICDF_FAILED = "pasicdff";
/** The digits the residual is checked against (the display digits); Digits − 10 when unset. */
export const ICDF_DIGITS = "pasicdfd";

/** A real number: a float, or an exact integer or rational (evalf(0) stays the integer 0). */
const REAL = (v: string) => `(type(${v})==integer or type(${v})==rational or type(evalf(${v}))==DOM_FLOAT)`;

/** The definitions, in the order they are loaded (helpers first). Every parameter and local is written pas<name>_ (G303,
 *  ourNames.ts OUR_BOUND): G221f1, a free name passed as an argument is evaluated in the definition's scope by evalf, type
 *  or a comparison (student_cdf(x,1) read the free x as pascdfok's own x and showed 0.75). */
export const ICDF_DEFINITIONS: Readonly<Record<string, string>> = {
  // ln Γ(a) with MPFR at Digits.
  paslg: "paslg(pasa_):=lgamma(evalf(pasa_))",
  // Lentz's evaluation of the continued fraction of I_x(a,b) (DLMF 8.17.22), y = 1 − x given separately. G221: a loop that
  // ends without converging sets the flag here and in the series below: its truncation is the same at P and P + 20, so
  // the agreement check would confirm digits no iteration reached.
  pasbetacf:
    "pasbetacf(pasa_,pasb_,pasx_,pasy_):={ local pastn_,pastol_,pasfv_,pascv_,pasdv_,pasj_,pasm_,pash_,pasaj_,pasdl_; pastn_:=evalf(10^(-2*Digits)); pastol_:=evalf(10^(-Digits-2)); " +
    "pasfv_:=pastn_; pascv_:=pasfv_; pasdv_:=0; " +
    "for (pasj_:=1;pasj_<=20000;pasj_:=pasj_+1) { if (pasj_==1) pasaj_:=1; else { pasm_:=pasj_-1; if (irem(pasm_,2)==1) { pash_:=(pasm_-1)/2; pasaj_:=-(pasa_+pash_)*(pasa_+pasb_+pash_)*pasx_/((pasa_+2*pash_)*(pasa_+2*pash_+1)); } " +
    "else { pash_:=pasm_/2; pasaj_:=pash_*(pasb_-pash_)*pasx_/((pasa_+2*pash_-1)*(pasa_+2*pash_)); } } " +
    "pasdv_:=1+pasaj_*pasdv_; if (pasdv_==0) pasdv_:=pastn_; pascv_:=1+pasaj_/pascv_; if (pascv_==0) pascv_:=pastn_; pasdv_:=1/pasdv_; pasdl_:=pascv_*pasdv_; pasfv_:=pasfv_*pasdl_; if (abs(pasdl_-1)<pastol_) break; } " +
    `if (pasj_>20000) ${ICDF_FAILED}:=1; ` +
    "return exp(pasa_*ln(pasx_)+pasb_*ln(pasy_)-paslg(pasa_)-paslg(pasb_)+paslg(pasa_+pasb_))/pasa_*pasfv_; }",
  // erf(y) for 0 ≤ y < 2 at Digits by its series of positive terms (DLMF 7.6.2). Giac's MPFR erf of a float below
  // about 1E-11 is the argument itself (erf(1e-19) gives 1e-19, right 1.128…e-19).
  paserf:
    "paserf(pasy_):={ local pastol_,pass_,past_,pasn_; if (pasy_==0) return 0; pastol_:=evalf(10^(-Digits-2)); past_:=pasy_; pass_:=past_; " +
    "for (pasn_:=1;pasn_<=100000;pasn_:=pasn_+1) { past_:=past_*2*pasy_^2/(2*pasn_+1); pass_:=pass_+past_; if (past_<pass_*pastol_) break; } return 2/sqrt(pi)*exp(-pasy_^2)*pass_; }",
  // erfc(y) for y ≥ 0 at Digits: 1 − erf(y) below 2 (at most 3 digits cancel), Laplace's continued fraction above
  // (DLMF 7.9.2). Giac's own MPFR erfc is 1 − erf: erfc(4.5) at 40 digits is right to 31 digits only, and erfc of a
  // negative float is erfc(|x|) (erfc(-1.0) at 40 digits gives 0.157…, right 1.842…).
  paserfc:
    "paserfc(pasy_):={ local pastn_,pastol_,pasfv_,pascv_,pasdv_,pasj_,pasaj_,pasdl_; if (pasy_<2) return 1-paserf(pasy_); pastn_:=evalf(10^(-2*Digits)); pastol_:=evalf(10^(-Digits-2)); " +
    "pasfv_:=pastn_; pascv_:=pasfv_; pasdv_:=0; " +
    "for (pasj_:=1;pasj_<=20000;pasj_:=pasj_+1) { if (pasj_==1) pasaj_:=1; else pasaj_:=(pasj_-1)/2; " +
    "pasdv_:=pasy_+pasaj_*pasdv_; if (pasdv_==0) pasdv_:=pastn_; pascv_:=pasy_+pasaj_/pascv_; if (pascv_==0) pascv_:=pastn_; pasdv_:=1/pasdv_; pasdl_:=pascv_*pasdv_; pasfv_:=pasfv_*pasdl_; if (abs(pasdl_-1)<pastol_) break; } " +
    `if (pasj_>20000) ${ICDF_FAILED}:=1; ` +
    "return exp(-pasy_^2)/sqrt(pi)*pasfv_; }",
  // G44f1: erf and erfc of any argument at Digits: erf(-y) = -erf(y), erfc(-y) = 2 - erfc(y), erf(y) = 1 - erfc(y) from
  // 2 on (the continued fraction keeps the tail's digits). A list is mapped; an argument that is not a real number is
  // left to Giac's own function, with the flag set.
  paserfv:
    "paserfv(pasz_):={ local pasy_; if (type(pasz_)==DOM_LIST) return map(pasz_,paserfv); if (pasz_==0) return 0; pasy_:=evalf(pasz_); " +
    `if (type(pasy_)!=DOM_FLOAT) { ${ICDF_FAILED}:=1; return erf(pasz_); } if (pasy_<0) return -paserfv(-pasy_); if (pasy_<2) return paserf(pasy_); return 1-paserfc(pasy_); }`,
  paserfcv:
    "paserfcv(pasz_):={ local pasy_; if (type(pasz_)==DOM_LIST) return map(pasz_,paserfcv); if (pasz_==0) return 1; pasy_:=evalf(pasz_); " +
    `if (type(pasy_)!=DOM_FLOAT) { ${ICDF_FAILED}:=1; return erfc(pasz_); } if (pasy_<0) return 2-paserfc(-pasy_); return paserfc(pasy_); }`,
  // [I_x(a,b), I_y(b,a)] = [lower, upper], the smaller one computed directly.
  pasibeta:
    "pasibeta(pasa_,pasb_,pasx_,pasy_):={ local pass_; if (pasx_<=0) return [0,1]; if (pasy_<=0) return [1,0]; " +
    "if (pasx_<(pasa_+1)/(pasa_+pasb_+2)) { pass_:=pasbetacf(pasa_,pasb_,pasx_,pasy_); return [pass_,1-pass_]; } pass_:=pasbetacf(pasb_,pasa_,pasy_,pasx_); return [1-pass_,pass_]; }",
  // [P(a,x), Q(a,x)]: the series below a + 1 (DLMF 8.7.1), else Legendre's continued fraction (DLMF 8.9.2).
  pasigamma:
    "pasigamma(pasa_,pasx_):={ local pastn_,pastol_,paspre_,pass_,past_,pasn_,pasfv_,pascv_,pasdv_,pasj_,pasaj_,pasbj_,pasdl_; if (pasx_<=0) return [0,1]; " +
    "pastn_:=evalf(10^(-2*Digits)); pastol_:=evalf(10^(-Digits-2)); paspre_:=exp(pasa_*ln(pasx_)-pasx_-paslg(pasa_)); " +
    "if (pasx_<pasa_+1) { past_:=1/pasa_; pass_:=past_; for (pasn_:=1;pasn_<=100000;pasn_:=pasn_+1) { past_:=past_*pasx_/(pasa_+pasn_); pass_:=pass_+past_; if (abs(past_)<abs(pass_)*pastol_) break; } " +
    `if (pasn_>100000) ${ICDF_FAILED}:=1; ` +
    "pass_:=pass_*paspre_; return [pass_,1-pass_]; } " +
    "pasfv_:=pastn_; pascv_:=pasfv_; pasdv_:=0; " +
    "for (pasj_:=1;pasj_<=20000;pasj_:=pasj_+1) { if (pasj_==1) { pasaj_:=1; pasbj_:=pasx_+1-pasa_; } else { pasaj_:=-(pasj_-1)*(pasj_-1-pasa_); pasbj_:=pasx_+2*pasj_-1-pasa_; } " +
    "pasdv_:=pasbj_+pasaj_*pasdv_; if (pasdv_==0) pasdv_:=pastn_; pascv_:=pasbj_+pasaj_/pascv_; if (pascv_==0) pascv_:=pastn_; pasdv_:=1/pasdv_; pasdl_:=pascv_*pasdv_; pasfv_:=pasfv_*pasdl_; if (abs(pasdl_-1)<pastol_) break; } " +
    `if (pasj_>20000) ${ICDF_FAILED}:=1; ` +
    "pass_:=paspre_*pasfv_; return [1-pass_,pass_]; }",
  // [lower tail, upper tail, density, lower tail − 1/2] at x of: k = 0 normal (a = μ, b = σ), 1 Student (a = ν),
  // 2 χ² (a = k), 3 Fisher (a = d₁, b = d₂). The last is computed directly for the symmetric two (erf, I_y(1/2, ν/2)),
  // so a p next to 1/2 keeps its digits (normald_icdf(1/2+10^-30)).
  pasicdft:
    "pasicdft(pask_,pasa_,pasb_,pasx_):={ local pasy_,pasz_,pass_,past_,pasw_; " +
    "if (pask_==0) { pasz_:=(pasx_-pasa_)/pasb_; pasw_:=exp(-pasz_^2/2)/(pasb_*sqrt(2*pi)); pasy_:=abs(pasz_)/sqrt(2); " +
    "if (pasy_<2) { past_:=paserf(pasy_)/2; pass_:=1/2-past_; } else { pass_:=paserfc(pasy_)/2; past_:=1/2-pass_; } if (pasz_<0) return [pass_,1-pass_,pasw_,-past_]; return [1-pass_,pass_,pasw_,past_]; } " +
    "if (pask_==1) { pasw_:=pasa_+pasx_^2; pass_:=pasibeta(pasa_/2,1/2,pasa_/pasw_,pasx_^2/pasw_); past_:=pass_[0]/2; " +
    "pasz_:=exp(paslg((pasa_+1)/2)-paslg(pasa_/2)-(pasa_+1)/2*ln(1+pasx_^2/pasa_))/sqrt(pasa_*pi); if (pasx_>0) return [1-past_,past_,pasz_,pass_[1]/2]; return [past_,1-past_,pasz_,-pass_[1]/2]; } " +
    "if (pasx_<=0) return [0,1,0,-1/2]; " +
    "if (pask_==2) { pass_:=pasigamma(pasa_/2,pasx_/2); return [pass_[0],pass_[1],exp((pasa_/2-1)*ln(pasx_)-pasx_/2-pasa_/2*ln(2)-paslg(pasa_/2)),pass_[0]-1/2]; } " +
    "pasw_:=pasa_*pasx_+pasb_; pass_:=pasibeta(pasa_/2,pasb_/2,pasa_*pasx_/pasw_,pasb_/pasw_); " +
    "return [pass_[0],pass_[1],exp(pasa_/2*ln(pasa_*pasx_/pasw_)+pasb_/2*ln(pasb_/pasw_)-ln(pasx_)-paslg(pasa_/2)-paslg(pasb_/2)+paslg(pasa_/2+pasb_/2)),pass_[0]-1/2]; }",
  // Newton from Giac's x0 on the smaller tail; Giac's x0 with the flag set when it cannot be polished.
  pasicdf:
    "pasicdf(pask_,pasa_,pasb_,pasp_,pasx0_):={ local pasx_,pasq_,paslo_,pasmd_,past_,pasr_,pasw_,pasdx_,pasn_,pasok_,pastol_,pasd_,pasxl_,pasxh_,pasj_,pasus_,pasxs_,pasxc_,pasbr_,paspv_; " +
    `if (size(lname([pasp_,pasa_,pasb_]))>0) { ${ICDF_FAILED}:=1; return pasx0_; } ` +
    `if (not(${REAL("pasp_")}) or not(${REAL("pasa_")}) or not(${REAL("pasb_")})) { ${ICDF_FAILED}:=1; return pasx0_; } ` +
    `if ((pask_>0 and pasa_<=0) or ((pask_==0 or pask_==3) and pasb_<=0)) { ${ICDF_FAILED}:=1; return pasx0_; } ` +
    // G44f1: at p = 0 and p = 1 Giac's value is the end of the support (±infinity, 0), which is exact.
    `if (pasp_==0 or pasp_==1) return pasx0_; if (pasp_<0 or pasp_>1) { ${ICDF_FAILED}:=1; return pasx0_; } ` +
    // The median of the symmetric ones is exact (Giac's normald_icdf(0.5) is -1.9E-19).
    "if (pasp_==1/2 and pask_==0) return pasa_; if (pasp_==1/2 and pask_==1) return 0; " +
    // md: p next to the median of a symmetric one, solved for F(x) − 1/2 = p − 1/2; else on the smaller tail.
    // Giac's value as the start (us = 1); its centre when that is not a real number in the support (fisher_icdf(3,4,1-10^-20)
    // is +infinity, chisquare_icdf(3,10^-30) is negative, normald_icdf(10^-30) is undef from about the third call, G44f2).
    "pasxc_:=evalf(when(pask_==0,pasa_,when(pask_==1,0,when(pask_==2,pasa_,1)))); pasxs_:=pasxc_; pasus_:=0; " +
    `if (${REAL("pasx0_")}) { if (not((pask_==2 or pask_==3) and pasx0_<=0)) { pasxs_:=evalf(exact(pasx0_)); pasus_:=1; } } ` +
    "pasmd_:=(pask_<=1 and pasp_>1/4 and pasp_<3/4); paslo_:=(pasp_<=1/2); " +
    "if (pasmd_) pasq_:=abs(pasp_-1/2); else { if (paslo_) pasq_:=pasp_; else pasq_:=1-pasp_; } pastol_:=evalf(10^(5-Digits)); pasok_:=0; " +
    // pv 0: Newton from the start; pv 1, for the upper tail of χ² and Fisher (br) with no usable start or when Newton from
    // it did not converge (G44f2f1: the bracket every time made chisquare_icdf(3,9/10) 3 to 4 times slower, and Home's
    // budget cut the agreement run): first a bracket in ln x, x doubled (or halved) until the upper tail crosses 1 − p,
    // then bisected in ln x down to a ratio of 1.01, so that Newton starts next to the root (G44f2:
    // chisquare_icdf(3,1-10^-30) from the centre took more than 20 steps). The bracket starts from the centre, as a start
    // Newton could not use is no better. Not bracketed in 60 doublings: refused.
    "pasbr_:=((pask_==2 or pask_==3) and not(paslo_)); " +
    "for (paspv_:=when(pasbr_ and pasus_==1,0,1);paspv_<=1 and pasok_==0;paspv_:=paspv_+1) { pasx_:=when(pasbr_ and paspv_==1,pasxc_,pasxs_); " +
    "if (pasbr_ and paspv_==1) { past_:=pasicdft(pask_,pasa_,pasb_,pasx_); pasj_:=0; " +
    "if (past_[1]>pasq_) { while (pasj_<60 and past_[1]>pasq_) { pasx_:=2*pasx_; past_:=pasicdft(pask_,pasa_,pasb_,pasx_); pasj_:=pasj_+1; } pasxl_:=pasx_/2; pasxh_:=pasx_; } " +
    "else { while (pasj_<60 and not(past_[1]>pasq_)) { pasx_:=pasx_/2; past_:=pasicdft(pask_,pasa_,pasb_,pasx_); pasj_:=pasj_+1; } pasxl_:=pasx_; pasxh_:=2*pasx_; } " +
    `if (pasj_>=60) { ${ICDF_FAILED}:=1; return pasx0_; } ` +
    "for (pasj_:=1;pasj_<=30 and pasxh_>pasxl_*1.01;pasj_:=pasj_+1) { pasx_:=sqrt(pasxl_*pasxh_); past_:=pasicdft(pask_,pasa_,pasb_,pasx_); if (past_[1]>pasq_) pasxl_:=pasx_; else pasxh_:=pasx_; } pasx_:=sqrt(pasxl_*pasxh_); } " +
    "for (pasn_:=1;pasn_<=20;pasn_:=pasn_+1) { past_:=pasicdft(pask_,pasa_,pasb_,pasx_); if (not(past_[2]>0)) break; " +
    // In a tail, Newton on ln F: the same root and the derivative f/F, but it converges from Giac's far value
    // (normald_icdf below 1E-16 is a different number on each call: -8.58, -8.65 for 10^-20, right -9.26).
    "if (pasmd_) pasdx_:=(past_[3]-(pasp_-1/2))/past_[2]; else { if (paslo_) pasw_:=past_[0]; else pasw_:=past_[1]; if (not(pasw_>0)) break; " +
    "pasdx_:=(ln(pasw_)-ln(pasq_))*pasw_/past_[2]; if (not(paslo_)) pasdx_:=-pasdx_; } " +
    // χ² and Fisher live on x > 0 and have power-law tails at 0: the step is taken in ln x, and dx becomes the step x
    // made (G140f2: dx is in units of the old x, so from a start far below the root, Giac's fisher_icdf(3,4,10^-20) of
    // 1.4E-64 on some calls, the first step of 3.4E-14 counted as 1.7E-62 and stopped Newton 13 digits short).
    "if (pask_==2 or pask_==3) { pasw_:=pasx_; pasx_:=pasx_*exp(-pasdx_/pasx_); pasdx_:=pasx_-pasw_; } else pasx_:=pasx_-pasdx_; if (abs(pasdx_)<=pastol_*max(abs(pasx_),when(pask_==0,pasb_,when(pask_==1,1,0)))) { pasok_:=1; break; } } } " +
    `if (pasok_==1) { past_:=pasicdft(pask_,pasa_,pasb_,pasx_); if (pasmd_) pasr_:=past_[3]-(pasp_-1/2); else { if (paslo_) pasr_:=past_[0]-pasp_; else pasr_:=pasq_-past_[1]; } ` +
    `if (type(${ICDF_DIGITS})==integer) pasd_:=${ICDF_DIGITS}; else pasd_:=Digits-10; if (abs(pasr_)>pasq_*10^(-pasd_)) pasok_:=0; } ` +
    `if (pasok_==0) { ${ICDF_FAILED}:=1; return pasx0_; } return pasx_; }`,
  // The four Giac names with their arguments; the arguments of a call to a one-parameter function come as one sequence.
  pasnormald_icdf:
    "pasnormald_icdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==1) return pasicdf(0,0,1,pasv_[0],normald_icdf(pasv_[0])); " +
    `if (size(pasv_)==3) return pasicdf(0,pasv_[0],pasv_[1],pasv_[2],normald_icdf(pasv_[0],pasv_[1],pasv_[2])); ${ICDF_FAILED}:=1; return normald_icdf(pasl_); }`,
  passtudent_icdf:
    "passtudent_icdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==2) return pasicdf(1,pasv_[0],1,pasv_[1],student_icdf(pasv_[0],pasv_[1])); " +
    `${ICDF_FAILED}:=1; return student_icdf(pasl_); }`,
  paschisquare_icdf:
    "paschisquare_icdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==2) return pasicdf(2,pasv_[0],1,pasv_[1],chisquare_icdf(pasv_[0],pasv_[1])); " +
    `${ICDF_FAILED}:=1; return chisquare_icdf(pasl_); }`,
  pasfisher_icdf:
    "pasfisher_icdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==3) return pasicdf(3,pasv_[0],pasv_[1],pasv_[2],fisher_icdf(pasv_[0],pasv_[1],pasv_[2])); " +
    `${ICDF_FAILED}:=1; return fisher_icdf(pasl_); }`,
  // G221 (F195): the forward functions: 1 when the arguments are real and in the distribution's range. G221f1: lname first, as it
  // reads the arguments without evaluating them again; evalf would read a free name through this definition's scope.
  pascdfok: `pascdfok(pask_,pasa_,pasb_,pasx_,pasz_):={ if (size(lname([pasa_,pasb_,pasx_,pasz_]))>0) return 0; if (not(${REAL("pasa_")}) or not(${REAL("pasb_")}) or not(${REAL("pasx_")}) or not(${REAL("pasz_")})) return 0; if ((pask_>0 and evalf(pasa_)<=0) or (pask_==0 and evalf(pasb_)<=0)) return 0; return 1; }`,
  // tail j (0 lower, 1 upper) at x; pasicdft computes each tail directly on its own side
  pascdf1: "pascdf1(pask_,pasa_,pasb_,pasx_,pasj_):=pasicdft(pask_,evalf(pasa_),evalf(pasb_),evalf(pasx_))[pasj_]",
  // F(z) − F(x), on the upper tails when both bounds are in the upper one (the lower ones would cancel)
  pascdf2:
    "pascdf2(pask_,pasa_,pasb_,pasx_,pasz_):={ local pass_,past_; pass_:=pasicdft(pask_,evalf(pasa_),evalf(pasb_),evalf(pasx_)); past_:=pasicdft(pask_,evalf(pasa_),evalf(pasb_),evalf(pasz_)); " +
    "if (pass_[0]>1/2 and past_[0]>1/2) return pass_[1]-past_[1]; return past_[0]-pass_[0]; }",
  // Giac's own function, with the flag set, for what is not read here. Giac refuses a ν that is no integer; ours has no such limit.
  passtudent_cdf:
    "passtudent_cdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==2) { if (pascdfok(1,pasv_[0],1,pasv_[1],pasv_[1])) return pascdf1(1,pasv_[0],1,pasv_[1],0); } " +
    `if (size(pasv_)==3) { if (pascdfok(1,pasv_[0],1,pasv_[1],pasv_[2])) return pascdf2(1,pasv_[0],1,pasv_[1],pasv_[2]); } ${ICDF_FAILED}:=1; return student_cdf(pasl_); }`,
  paschisquare_cdf:
    "paschisquare_cdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==2) { if (pascdfok(2,pasv_[0],1,pasv_[1],pasv_[1])) return pascdf1(2,pasv_[0],1,pasv_[1],0); } " +
    `if (size(pasv_)==3) { if (pascdfok(2,pasv_[0],1,pasv_[1],pasv_[2])) return pascdf2(2,pasv_[0],1,pasv_[1],pasv_[2]); } ${ICDF_FAILED}:=1; return chisquare_cdf(pasl_); }`,
  // (x), (μ,σ,x), (μ,σ,a,b); bounds a > b are Giac's own error. Giac's (a,b) stays its double, with ⚠.
  pasnormald_cdf:
    "pasnormald_cdf(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==1) { if (pascdfok(0,0,1,pasv_[0],pasv_[0])) return pascdf1(0,0,1,pasv_[0],0); } " +
    "if (size(pasv_)==3) { if (pascdfok(0,pasv_[0],pasv_[1],pasv_[2],pasv_[2])) return pascdf1(0,pasv_[0],pasv_[1],pasv_[2],0); } " +
    "if (size(pasv_)==4) { if (pascdfok(0,pasv_[0],pasv_[1],pasv_[2],pasv_[3])) { if (evalf(pasv_[2])<=evalf(pasv_[3])) return pascdf2(0,pasv_[0],pasv_[1],pasv_[2],pasv_[3]); } } " +
    `${ICDF_FAILED}:=1; return normald_cdf(pasl_); }`,
  // UTPN(x), UTPN(μ,v,x): the upper tail, v the variance (Giac: UTPN(1,2,3) is (1-erf(1))/2).
  pasutpn:
    "pasutpn(pasl_):={ local pasv_; pasv_:=[pasl_]; if (size(pasv_)==1) { if (pascdfok(0,0,1,pasv_[0],pasv_[0])) return pascdf1(0,0,1,pasv_[0],1); } " +
    "if (size(pasv_)==3) { if (pascdfok(0,pasv_[0],sqrt(pasv_[1]),pasv_[2],pasv_[2])) return pascdf1(0,pasv_[0],sqrt(pasv_[1]),pasv_[2],1); } " +
    `${ICDF_FAILED}:=1; return UTPN(pasl_); }`,
};

/** The polished names `text` calls (outside strings). */
export function icdfCalls(text: string): string[] {
  return functionsIn(text, "typed").filter((f) => Object.hasOwn(ICDF_REPLACED, f));
}

/** G221: the polished names `text` calls whose Giac infinity or undef the polish may replace: the inverse functions and
 *  erf; a forward function's undef (normald_cdf(0,0,1)) is Giac's own answer to a call that has no value. */
export function icdfEndCalls(text: string): string[] {
  return icdfCalls(text).filter((f) => !Object.hasOwn(CDF_REPLACED, f));
}

/** G221: `text` calls a function Giac refuses for arguments ours computes (student_cdf(2.5,1): Bad Argument Value). */
export function giacRefusesOurs(text: string): boolean {
  return icdfCalls(text).some((f) => CDF_REPLACED[f] === "passtudent_cdf");
}

/** `text` with every call of a polished name replaced by ours, and our definitions loaded on first use. */
export function icdfPolished(giac: Giac, text: string): string {
  for (const [name, def] of Object.entries(ICDF_DEFINITIONS)) {
    // A defined function prints as its program; an undefined name prints as itself.
    if (giac.eval(name).trim() === name) giac.eval(def);
  }
  return renameCalls(text, ICDF_REPLACED, "typed");
}

/** The definitions erf and erfc are read through, loaded together: the last one stands for all. */
const ERF_DEFINITIONS = ["paserf", "paserfc", "paserfv", "paserfcv"] as const;
const ERF_REPLACED: Readonly<Record<string, string>> = { erf: ICDF_REPLACED.erf!, erfc: ICDF_REPLACED.erfc! };

/**
 * G44f1: `text` (an exact result as Giac prints it, or a typed input: `q` says which) for its value, with erf and erfc read through our MPFR definitions
 * and the definitions loaded on first use; the text itself when it calls neither. Giac prints erfc(u) as 1-erf(u),
 * which cancels the tail's digits (erfc(10) loses 45): a term 1-erf(u) is read as erfc(u) when nothing binds tighter
 * on either side. G220 (F195): the same for a term erf(u)+1, read as erfc(-(u)): Giac prints normald_cdf(0,1,-20) as
 * (erf(-10*sqrt(2))+1)/2, whose sum is 0 at any precision below 89 digits. `erfc(-u)` is 2 - erfc(u) for u > 0 (paserfcv),
 * so the side away from the tail keeps its digits.
 */
export function erfValueText(giac: Giac, text: string, q: Quoting): string {
  if (!functionsIn(text, q).some((f) => Object.hasOwn(ERF_REPLACED, f))) return text;
  let s = text;
  // the strings blanked to their length, so a "1-erf(" inside one is not read as a term
  let bare = withoutStrings(s, (str) => " ".repeat(str.length), q);
  // nothing binds tighter on either side of the term s[k..end)
  const alone = (k: number, end: number): boolean => /^[(,[+]?$/.test(k === 0 ? "" : s[k - 1]!) && /^[),\]+-]?$/.test(end === s.length ? "" : s[end]!);
  for (let k = bare.indexOf("1-erf("); k >= 0; k = bare.indexOf("1-erf(", k + 1)) {
    const close = closing(s, k + 5, q);
    if (close < 0) break;
    if (!alone(k, close + 1)) continue;
    s = `${s.slice(0, k)}erfc(${s.slice(k + 6)}`;
    bare = withoutStrings(s, (str) => " ".repeat(str.length), q);
  }
  // from the last call back: a rewrite leaves the places before it as they were (the close of an outer call is found again)
  for (const c of callsOf(s, ["erf"], q).reverse()) {
    const close = closing(s, c.open, q);
    if (close < 0 || s.slice(close + 1, close + 3) !== "+1" || !alone(c.at, close + 3)) continue;
    s = `${s.slice(0, c.at)}erfc(-(${s.slice(c.open + 1, close)}))${s.slice(close + 3)}`;
  }
  s = renameCalls(s, ERF_REPLACED, q);
  const last = ERF_DEFINITIONS[ERF_DEFINITIONS.length - 1]!;
  if (giac.eval(last).trim() === last) for (const name of ERF_DEFINITIONS) giac.eval(ICDF_DEFINITIONS[name]!);
  return s;
}

/** G44f1: whether the polish of `text` at P = max(40, digits + 10) gives ±infinity with no call falling back to Giac's
 *  value: p = 0 or 1, where Giac's infinity is the exact end of the support. False for a refused polish (an argument
 *  out of range, Newton not converging) and for one that converged to a finite number. */
export function icdfAtEnd(giac: Giac, text: string, digits: number): boolean {
  const polished = icdfPolished(giac, text);
  giac.eval(`${ICDF_FAILED}:=0`);
  giac.eval(`${ICDF_DIGITS}:=${digits}`);
  giac.eval(`Digits:=${Math.max(40, digits + 10)}`);
  try {
    const value = giac.eval(`pasicdfr:=(${polished})`).trim();
    return giac.eval(ICDF_FAILED).trim() === "0" && /^[+-]?infinity$/.test(value);
  } finally {
    giac.eval(`Digits:=${digits}`);
    giac.eval(`purge(pasicdfr,${ICDF_FAILED},${ICDF_DIGITS})`);
  }
}
