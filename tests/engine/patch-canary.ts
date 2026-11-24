// SPDX-License-Identifier: GPL-3.0-or-later
// Canaries of our Giac patches (P19, engine/giac/patches/README.md): each checks that the pinned tarball still has the
// line its patch replaces. A patch whose cause upstream has fixed fails here: then the patch can go at that pin (and
// `patch --forward` would refuse it anyway). Reads the tarball only; no engine, no network.
//   node tests/engine/patch-canary.ts        # N62_DL_DIR: the tarball cache (default engine/giac/_downloads)
import { SOURCES, member, tarball } from "../../tools/find-index/state.mjs";

// [patch, file in the tarball, the wrong text it replaces, the text near it that locates it]
const CANARIES: [string, string, RegExp, string][] = [
  // S17: the EMCC add_evalf hook logs on every caseval (and reads the misspelt UI.addevalf)
  ["0001-gen-remove-add_evalf-debug-log.patch", "giac-2.1.0/src/gen.cc", /console\.log\("gen\.cc add_evalf",UI\.addevalf\);/, "double add_evalf=EM_ASM_DOUBLE_V({"],
  // S17: in EMCC builds control_c compares whole seconds from time(0)
  ["0002-emcc-subsecond-caseval-timeout.patch", "giac-2.1.0/src/global.cc", /if \(difftime\(caseval_current,caseval_begin\)>caseval_maxtime\)/, "void control_c(){"],
  // complex MPFR tanh returns coth: `gen g=exp(2*e,contextptr); return (g+1)/(g-1);` in tanh's _CPLX branch
  ["0003-complex-tanh-mpfr.patch", "giac-2.1.0/src/usual.cc", /gen g=exp\(2\*e,contextptr\);\s*return \(g\+1\)\/\(g-1\);/, "gen tanh(const gen & e0,GIAC_CONTEXT){"],
  // G82: control_c checks only the clock; nothing counts its calls between the reset and the clock check
  ["0004-caseval-step-budget.patch", "giac-2.1.0/src/global.cc", /caseval_maxtime=15;\s*\}\s*if \(caseval_mod>0\)\{/, "void control_c(){"],
  // G60, patch 0005: ln of a negative MPFR real adds the symbolic pi, which meets the MPFR value as a double
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /return \(-e\)\._REALptr->log\(\)\+cst_pi\*cst_i;/, "gen ln(const gen & e,GIAC_CONTEXT){"],
  // asin and acos of an MPFR real call MPFR outside [-1,1] (NaN, so undef)
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /if \(e\.type==_REAL\)\{\s*if \(angle_radian\(contextptr\)\)\s*return e\._REALptr->asin\(\);/, "gen asin(const gen & e0,GIAC_CONTEXT){"],
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /if \(e\.type==_REAL\)\{\s*if \(angle_radian\(contextptr\)\)\s*return e\._REALptr->acos\(\);/, "gen acos(const gen & e0,GIAC_CONTEXT){"],
  // complex acos: the symbolic pi/2 meets the MPFR value as a double
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /gen res=cst_pi\/2-asinasln\(e,contextptr\);/, "gen acos(const gen & e0,GIAC_CONTEXT){"],
  // acosh of a real below 1: the negated ln, the conjugate of the principal value
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /if \(is_positive\(-x,contextptr\)\)\s*return -res;/, "static gen acoshasln(const gen & x,GIAC_CONTEXT){"],
  // G111, patch 0007: exponential's density and chisquare's check no support (exponential(21/10,-2) = 21/10*exp(21/5))
  ["0007-densities-outside-support.patch", "giac-2.1.0/src/moyal.cc", /if \(s==2\)\s*return v\[0\]\*exp\(-v\[0\]\*v\[1\],contextptr\);/, "gen _exponential(const gen & g,GIAC_CONTEXT){"],
  ["0007-densities-outside-support.patch", "giac-2.1.0/src/moyal.cc", /return apply2nd\(n,x,contextptr,chisquare\);\s*gen n2=n\/2;/, "gen chisquare(const gen & n,const gen & x,GIAC_CONTEXT){"],
  // G111, patch 0008: _fracmod passes any modulus to fracmod, whose in_fracmod takes mpz_sqrt of a negative one (a trap)
  ["0008-fracmod-positive-modulus.patch", "giac-2.1.0/src/usual.cc", /vecteur & v=\*args\._VECTptr;\s*return fracmod\(v\[0\],v\[1\]\);/, "gen _fracmod(const gen & args,GIAC_CONTEXT){"],
  // G113, patch 0009: a discrete pmf or cdf at a k off the integers took the formula (poisson(2,3/2) = 0.288)
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /if \(k\.type==_DOUBLE_ \|\| k\.type==_FLOAT_ \|\| k\.type==_FRAC\)\{\s*if \(p\.type==_DOUBLE_ \|\| p\.type==_FLOAT_ \|\| p\.type==_FRAC\)/, "gen binomial(const gen & N,const gen & K,const gen & P,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /swapgen\(k,p\);\s*if \(is_zero\(k\)\)\s*return pow\(p,r,contextptr\);/, "gen _negbinomial(const gen & g,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /gen n=v\[0\],p=v\[1\],k=v\[2\];\s*return _Beta\(makesequence\(n,k\+1,p,1\),contextptr\);/, "gen _negbinomial_cdf(const gen & g,GIAC_CONTEXT){"],
  // negbinomial_cdf(n,p,k1,k2) is cdf(k2)-cdf(k1), which leaves k1 out (aide_cas: Proba(x<=X<=y))
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return _Beta\(makesequence\(n,k2\+1,p,1\),contextptr\)-_Beta\(makesequence\(n,k1\+1,p,1\),contextptr\);/, "gen _negbinomial_cdf(const gen & g,GIAC_CONTEXT){"],
  // negbinomial_icdf reads T._DOUBLE_val of an unconverted T (an exact 1/5 reads as 0)
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /gen R=v\[0\],P=evalf_double\(v\[1\],1,contextptr\),T=v\[2\];/, "gen _negbinomial_icdf(const gen & g,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return apply2nd\(m,k,contextptr,poisson\);\s*gen M=evalf_double\(m,1,contextptr\);/, "gen poisson(const gen & m,const gen & k,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /^gen poisson_cdf\(const gen & lambda_,const gen & x,GIAC_CONTEXT\)\{\s*gen fx=_floor\(x,contextptr\);/, "gen poisson_cdf(const gen & lambda_,const gen & x,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return poisson_cdf\(v\[0\],v\[2\],contextptr\)-poisson_cdf\(v\[0\],v\[1\]-1,contextptr\);/, "gen _poisson_cdf(const gen & g,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /gen K\(k\);\s*if \(is_positive\(-k,contextptr\)\)\s*return gensizeerr\(contextptr\);\s*return pow\(1-p,k-1,contextptr\)\*p;/, "gen geometric(const gen & p,const gen & k,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /if \(is_strictly_positive\(-k,contextptr\)\)\s*return gensizeerr\(contextptr\);\s*return 1-pow\(1-p,k,contextptr\);/, "gen geometric_cdf(const gen & p,const gen & k,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return geometric_cdf\(v\[0\],v\[2\],contextptr\)-geometric_cdf\(v\[0\],v\[1\]-1,contextptr\);/, "gen _geometric_cdf(const gen & g,GIAC_CONTEXT){"],
  // G113f1, patch 0010: negbinomial_icdf adds the cdf in a long double (an exact tie that is no binary fraction lands one step high) and returns 1 for t >= 1
  ["0010-negbinomial-icdf-exact.patch", "giac-2.1.0/src/moyal.cc", /if \(t<=0\)\s*return 0;\s*if \(t>=1\)\s*return 1;\s*long_double cumul=std::pow\(p,r\),current=cumul;/, "gen _negbinomial_icdf(const gen & g,GIAC_CONTEXT){"],
  // G115, patch 0011: atan's pi/12 test takes a double root within 1e-7 for exact, with no normal(...)==0 (atan(cos(pi/100000)) = pi/4)
  ["0011-atan-pi12-exact-check.patch", "giac-2.1.0/src/usual.cc", /edh=horner\(makevecteur\(-3,55,-198,198,-55,3\),tmp\*tmp\);\s*if \(absdouble\(edh\._DOUBLE_val\)<1e-7\)\{/, "// detect if atan is a multiples of pi/10"],
  // G118, patch 0012: pow takes abs(b)^n as b^n (even n) when b has no literal i, real or not (abs(acos(pi))^2 = acos(pi)^2)
  ["0012-abs-power-real-base.patch", "giac-2.1.0/src/gen.cc", /if \(u==at_abs && exponent\.type==_INT_ && !complex_mode\(contextptr\) && !has_i\(base\)\)\{/, "if (u==at_unit){"],
  ["0012-abs-power-real-base.patch", "giac-2.1.0/src/gen.cc", /if \(\(exponent % 2==0\) && base\._SYMBptr->sommet==at_abs\)\s*return/, "gen pow(const gen & base, unsigned long int exponent){"],
  // G121, patch 0013: asin(sin(a)) = +-(a-n*pi) (and asin(cos(a)), acos(cos(a)) through it) for any a with a numeric value, real or not
  // (asin(sin(2*i)) = i*pi-2*i); the symbolic form of the same rule; ln(a^b) = b*ln(a) for a > 0 and any b (ln(2^(10*i)) = 10*i*ln(2))
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /^e=symbolic\(at_sin,cste\/2-e\._SYMBptr->feuille\);\s*if \(e\.is_symb_of_sommet\(at_sin\) && has_evalf\(e\._SYMBptr->feuille,a,1,contextptr\)\)\{/, "e=symbolic(at_sin,cste/2-e._SYMBptr->feuille);"],
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /if \(e\.is_symb_of_sommet\(at_sin\)\)\{\s*a=e\._SYMBptr->feuille;\s*gen n=_round\(a\/cste,contextptr\);/, "e=symbolic(at_sin,cste/2-e._SYMBptr->feuille);"],
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /^\/\/ ln\(a\^b\)\s*if \(is_positive\(a,contextptr\)\)\s*return b\*ln\(a,contextptr\);/, "// ln(a^b)"],
  // atan(tan(a)) = a-n*pi with n = floor(a/pi+1/2) of the double of any a, real or not (atan(tan(4*i)) = 4*i-i*pi)
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /gen tmp2=evalf_double\(e\._SYMBptr->feuille,0,contextptr\);\s*if \(tmp2\.type<_IDNT\)\s*tmp2=_floor\(tmp2\/tmp\+plus_one_half,contextptr\);/, "if (atan_tan_no_floor(contextptr))"],
  // G122, patch 0014: asin(sin(a)) = +-(a-n*pi) takes n = round(a/pi) from a at the current Digits and tests the parity of an _INT_ n only
  // (asin(cos(30!)) = 0.221 for -0.221, asin(sin(10^50)) at Digits 40 near 1.4e10)
  ["0014-asin-big-reduction.patch", "giac-2.1.0/src/usual.cc", /gen n=_round\(a\/cste,contextptr\);\s*b=a-n\*cste; \/\/ in \[-pi\/2,pi\/2\]\s*if \(n\.type==_INT_ && n\.val%2==0\)/, "// asin(sin(a))==a-2*k*pi or pi-a-2*k*pi"],
  // G165, patch 0031: the same rule takes n = round(a/pi) at the current Digits with no look at a tie: a/pi = 1/2-10^-50/pi reads as
  // 1/2, so n = 1 and acos(cos(10^-50)) = -10^-50 (right 10^-50)
  ["0031-asin-half-integer-tie.patch", "giac-2.1.0/src/usual.cc", /^\/\/ asin\(sin\(a\)\)==a-2\*k\*pi or pi-a-2\*k\*pi\s*gen n=_round\(a\/cste,contextptr\);\s*b=a-n\*cste;/, "// asin(sin(a))==a-2*k*pi or pi-a-2*k*pi"],
  // G166, patch 0032: atan(tan(a)) floors the double of a/pi+1/2, 16 digits: atan(tan(10^15)) = 10^15-318309886183790*pi (n one
  // low, 2.11), and next to the pole 1-10^-15/pi rounds to 1 (atan(tan(pi/2-10^-15)) = pi/2-10^-15-pi)
  ["0032-atan-tan-reduction-digits.patch", "giac-2.1.0/src/usual.cc", /gen tmp2=evalf_double\(e\._SYMBptr->feuille,0,contextptr\);\s*if \(tmp2\.type<_IDNT\)\s*tmp2=_floor\(tmp2\/tmp\+plus_one_half,contextptr\);\s*else\s*tmp2=_floor\(e\._SYMBptr->feuille\/tmp\+plus_one_half,contextptr\);/, "if (atan_tan_no_floor(contextptr))"],
  // G175, patch 0033: pow takes (e^a)^b as e^(a*b) for any a (sqrt(exp(4*i)) = exp(2*i), the other root)
  ["0033-pow-exp-principal-branch.patch", "giac-2.1.0/src/gen.cc", /if \(u==at_exp\)\{\s*\/\/ \(e\^a\)\^b=e\^\(a\*b\)[\s\S]{0,200}?gen res=exp\(base\._SYMBptr->feuille\*exponent,contextptr\);/, "if (u==at_sign && exponent.type==_INT_ && !complex_mode(contextptr) && !has_i(base)){"],
  // normal takes sqrt(s*d^2) as abs(d)*sqrt(s), and the root of D^d*S as D times that of S, for a d, D with a complex value
  // and no literal i (normal(sqrt(acosh(-1/2)^3)) = abs(z)*sqrt(z), simplify z*sqrt(z))
  ["0033-pow-exp-principal-branch.patch", "giac-2.1.0/src/sym2poly.cc", /if \(keep_abs\)\{\s*tmparg=abs\(tmparg,contextptr\);\s*tmpd=abs\(tmpd,contextptr\);/, "zint2simpldoublpos(cont,simpl,doubl,pos,2,contextptr);"],
  ["0033-pow-exp-principal-branch.patch", "giac-2.1.0/src/sym2poly.cc", /D=D\*pow\(jt->fact,jt->mult\/d\);\s*\}\s*\/\/ Check sign of D/, "const factorization f=rsqff(*num._POLYptr);"],
  // G177, patch 0034: the half-angle rules of cos, sin and tan sign the root by is_positive of the half angle's evalf, false
  // for a complex one (cos(atan(1+i)/2) = -0.891+0.0986*i, the negation)
  ["0034-half-atrig-complex-sign.patch", "giac-2.1.0/src/usual.cc", /f=sqrt\(\(inv\(sqrt\(1\+pow\(f,2\),contextptr\),contextptr\)\+1\)\/2,contextptr\);\s*if \(is_positive\(e_,contextptr\)\) return f; else return -f;/, "int n=is_half_atrig(e,f);"],
  ["0034-half-atrig-complex-sign.patch", "giac-2.1.0/src/usual.cc", /f=sqrt\(\(1-inv\(sqrt\(1\+pow\(f,2\),contextptr\),contextptr\)\)\/2,contextptr\);\s*if \(is_positive\(e_,contextptr\)\) return f; else return -f;/, "return rdiv(f,sqrt(pow(f,2)+1,contextptr),contextptr);"],
  ["0034-half-atrig-complex-sign.patch", "giac-2.1.0/src/usual.cc", /f=sqrt\(\(1-f\)\/\(1\+f\),contextptr\);\s*if \(is_positive\(e_,contextptr\)\) return f; else return -f;/, "return rdiv(sqrt(1-pow(f,2),contextptr),f,contextptr);"],
  // G126, patch 0015: the ln forms of asin and asinh cancel for a large x on one side (acos(-10^20+1/2) lost 40 digits)
  ["0015-asin-asinh-ln-cancellation.patch", "giac-2.1.0/src/usual.cc", /^static gen asinasln\(const gen & x,GIAC_CONTEXT\)\{\s*return -cst_i\*ln\(cst_i\*x\+sqrt\(1-x\*x,contextptr\),contextptr\);/, "static gen asinasln(const gen & x,GIAC_CONTEXT){"],
  ["0015-asin-asinh-ln-cancellation.patch", "giac-2.1.0/src/usual.cc", /^static gen asinhasln\(const gen & x,GIAC_CONTEXT\)\{\s*return ln\(x\+sqrt\(x\*x\+1,contextptr\),contextptr\);/, "static gen asinhasln(const gen & x,GIAC_CONTEXT){"],
  // G127, patch 0016: floor of a complex value that is not an exact Gaussian rational falls to symb_floor (floor(asin(pi)) stays unevaluated)
  ["0016-floor-complex-value.patch", "giac-2.1.0/src/usual.cc", /if \(tmp\.type==_CPLX && is_zero\(\*\(tmp\._CPLXptr\+1\),contextptr\)\)\s*tmp=\*tmp\._CPLXptr;\s*if \(tmp\.type==_REAL\)\{/, "static bool warnfloor=true;"],
  // G131, patch 0017: real_object::is_zero takes an MPFR NaN as zero (mpfr_sgn(NaN) is 0), so NaN times a complex number is the complex number
  ["0017-mpfr-nan-not-zero.patch", "giac-2.1.0/src/gen.cc", /bool real_object::is_zero\(\) const\{\s*#ifdef HAVE_LIBMPFR\s*return !mpfr_sgn\(inf\);/, "bool real_object::is_zero() const{"],
  // G132, patch 0018: pow takes (a^b)^c as a^(b*c) (or abs(a)^(b*c)) for any base with no literal i (sqrt(acosh(-1/2)^3) = the other root)
  ["0018-pow-of-pow-branch.patch", "giac-2.1.0/src/gen.cc", /return inv\(pow\(base\._SYMBptr->feuille,exponent,contextptr\),contextptr\);\s*if \(u==at_pow && !has_i\(base\)\)\{/, "if (u==at_inv && base._SYMBptr->feuille.type==_SYMB"],
  // G133, patch 0020: sqrt of a complex MPFR value takes an imaginary part within epsilon (1e-12) of 0 as 0 (sqrt(1.0-1e-20*i) = 1 at
  // any Digits), and asin's ln form loses -log2|x| bits for a small complex x
  ["0020-complex-sqrt-asin-small.patch", "giac-2.1.0/src/usual.cc", /a=re\(e,contextptr\);b=ratnormal\(im\(e,contextptr\),contextptr\);\s*if \(a!=e && is_zero\(b,contextptr\)\)\s*return sqrt\(a,contextptr\);/, "gen sqrt(const gen & e,GIAC_CONTEXT){"],
  ["0020-complex-sqrt-asin-small.patch", "giac-2.1.0/src/usual.cc", /^static gen asinasln\(const gen & x,GIAC_CONTEXT\)\{\s*return -cst_i\*ln\(cst_i\*x\+sqrt\(1-x\*x,contextptr\),contextptr\);/, "static gen asinasln(const gen & x,GIAC_CONTEXT){"],
  // G134, patch 0021: the exact sqrt of a complex a+b*i tests b = 0 after ratnormal only, then divides b by a+rho, 0/0 when b is an exact 0
  // that ratnormal leaves (sqrt(acosh(10^-6)^2+1) = 8.4e-8-4.3e-7*i, right 1.21*i), and a+rho cancels for a < 0 and a tiny b (fix round 1:
  // the evalf of acosh(1/2+i/10^20) at Digits 40 was a wrong root, -0.49+0.61*i)
  ["0021-complex-sqrt-unproved-zero.patch", "giac-2.1.0/src/usual.cc", /if \(a!=e && is_zero\(b,contextptr\)\)\s*return sqrt\(a,contextptr\);\s*if \( has_i\(a\) \|\| has_i\(b\) \)[\s\S]*return ratnormal\(realpart\/2,contextptr\)\*\(1\+cst_i\*b\/\(a\+rho\)\);/, "// sqrt of an exact complex number"],
  // G134, patch 0022: arg of a complex MPFR value tests its parts with is_zero, which compares an MPFR's double with epsilon (1e-12), so
  // both parts below 1e-12 give undef (ln, powers) and one beside a negative real part is 0 (arg(-1-1e-20*i) = +pi)
  ["0022-arg-mpfr-tiny-parts.patch", "giac-2.1.0/src/gen.cc", /if \(is_zero_or_contains\(realpart,contextptr\)\)\{\s*if \(is_zero_or_contains\(imagpart,contextptr\)\)\s*return undef;/, "gen arg_CPLX(const gen & a,GIAC_CONTEXT){"],
  ["0022-arg-mpfr-tiny-parts.patch", "giac-2.1.0/src/gen.cc", /case _REAL:\s*return fabs\(evalf_double\(a,1,contextptr\)\._DOUBLE_val\)<=epsilon\(contextptr\);/, "bool is_zero(const gen & a,GIAC_CONTEXT){"],
  // G133f1, patch 0023: asin's and asinh's ln forms leave their rounding in the real part of asin(i*y), asinh(i*y) (|y| <= 1),
  // which are purely imaginary (CAS evalf(asinh(i/10)) = -1.2E-66+0.100167421162*i)
  ["0023-asin-imaginary-real-part.patch", "giac-2.1.0/src/usual.cc", /^static gen asinasln\(const gen & x,GIAC_CONTEXT\)\{\s*return -cst_i\*ln\(cst_i\*x\+sqrt\(1-x\*x,contextptr\),contextptr\);/, "static gen asinasln(const gen & x,GIAC_CONTEXT){"],
  ["0023-asin-imaginary-real-part.patch", "giac-2.1.0/src/usual.cc", /^static gen asinhasln\(const gen & x,GIAC_CONTEXT\)\{\s*return ln\(x\+sqrt\(x\*x\+1,contextptr\),contextptr\);/, "static gen asinhasln(const gen & x,GIAC_CONTEXT){"],
  // G140, patch 0024: _evalf's overflow test asks z/z!=1 of a complex double, which rounds (Gamma(1.0+i)), so evalf(Gamma(1+i))
  // at Digits 14 ran again at 30 digits, where Gamma has no complex MPFR path, and stayed Gamma(1.0000000000000+i)
  ["0024-evalf-complex-double-workaround.patch", "giac-2.1.0/src/usual.cc", /^bool need_workaround\(const gen & g\)\{\s*if \(g\.type==_REAL \|\| \(g\.type==_CPLX && g\._CPLXptr->type==_REAL && \(g\._CPLXptr\+1\)->type==_REAL\)\)\s*return false;\s*if \(g\.type<=_CPLX\)\s*return g!=0 && g\/g!=1;/, "bool need_workaround(const gen & g){"],
  // G149, patch 0025: pow writes b^(n*s/d) as ((b^s)^(1/d))^r*(b^s)^q for any b and s, another branch where im(s*ln(b)) is
  // past pi (2^sqrt(-1-10^-3) = (2^(10*i*sqrt(10010)))^(1/1000), the root of 2^(1000.5*i); G160: also for a b whose double is not
  // finite, (10^400)^(i/1000) = ((10^400)^i)^(1/1000))
  ["0025-pow-root-extract-branch.patch", "giac-2.1.0/src/gen.cc", /gen res\(1\);\s*if \(r\)\{\s*if \(complex_mode\(contextptr\) && fastsign\(base,contextptr\)==-1\)\{/, "// extract integral powers in a product exponent"],
  // G151, patch 0026: asinh of an exact real ends in its ln form, which cancels at evalf for a small x
  // (surd(asinh(1/10^100),3) took the noise's sign, the complex root)
  ["0026-asinh-small-real-exact.patch", "giac-2.1.0/src/usual.cc", /if \(keep_acosh_asinh\(contextptr\)\)\s*return symbolic\(at_asinh,e\);\s*return ln\(e\+sqrt\(pow\(e,2\)\+1,contextptr\),contextptr\);/, "gen asinh(const gen & e0,GIAC_CONTEXT){"],
  // G153, patch 0027: atanh of an exact real ends in its ln form ln((1+x)/(1-x))/2, which cancels at evalf for a small x
  // (atanh(89999/10^1003) was 0 at 60 digits, so ln of it -infinity and Home's double fallback read noise)
  ["0027-atanh-small-real-exact.patch", "giac-2.1.0/src/usual.cc", /return symbolic\(at_program,gen\(makevecteur\(a,0,atanh\(b,contextptr\)\),_SEQ__VECT\)\);\s*return rdiv\(ln\(rdiv\(1\+e,1-e,contextptr\),contextptr\),plus_two\);/, "gen atanh(const gen & e0,GIAC_CONTEXT){"],
  // G157, patch 0028: trunc floors an argument whose sign Giac cannot prove (trunc(x) = floor(x), -2 at x = -13/10), and
  // trunc(x,n) floors d*x for either sign (trunc(-27/20,1) = -1.4)
  ["0028-trunc-toward-zero.patch", "giac-2.1.0/src/maple.cc", /if \(is_strictly_positive\(-args,contextptr\)\)\s*return -_floor\(-args,contextptr\);\s*return _floor\(args,contextptr\);\s*\}\s*static const char _trunc_s/, "gen _trunc(const gen & args,GIAC_CONTEXT){"],
  ["0028-trunc-toward-zero.patch", "giac-2.1.0/src/maple.cc", /return _floor\(d\*args\._VECTptr->front\(\),contextptr\)\/d;/, "gen _trunc(const gen & args,GIAC_CONTEXT){"],
  // G157f1, patch 0029: the definite integral splits floor (ceil as floor) at its jumps but not trunc, so x*trunc(x) is used
  // across trunc's jumps (int(trunc(x),x,-1/2,5/2) = 3*trunc(x), right 2)
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /v\[0\]=ceil2floor\(v\[0\],contextptr,true\);\s*vecteur lfloor\(lop\(v\[0\],at_floor\)\);/, "aorig=borne_inf=v[2];"],
  // ... a falling a*x+b from a non-integer start takes its first jump at n1-1, one interval late (int(ceil(x),x,1/2,3/2) = 1)
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /gen cur=borne_inf,next=\(n1\+stepn-b\)\/a,res=0;\s*if \(stepn==-1 && n1==a\*borne_inf\+b\)\s*n1 -= 1;\s*for \(/, "// find integers of the form a*x+b in [borne_inf,borne_sup]"],
  // ... the numeric check takes trunc as exactly integrable (its antiderivative x*trunc(x) across the jumps)
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /sign_floor_ceil_round_tab\)\.empty\(\) \)\s*return false;\s*if \(f\.type!=_SYMB/, "bool approxint_exact(const gen &f,const gen &x,GIAC_CONTEXT){"],
  // ... and an exact 0 fails the check against tegral's own error (int(trunc(x),x,-3/2,3/2) = [0,-2.9e-07])
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /return simplifier\(exactvalue,contextptr\);\s*\*logptr\(contextptr\) << gettext\("Error while checking exact value with approximate value, returning both!"\)/, "gen ck_int_numerically(const gen & f"],
  // G152, patch 0030: a negative real float to a float power k+1/2 is exp(e*ln(b)), whose real part is noise (evalf(sqrt(-pi))
  // = 4.1e-41+1.77*i at Digits 40, 9.6e-15+1.77*i at Digits 12), so acosh(cosh(3*sqrt(-pi))) took the other side of its cut
  ["0030-pow-half-odd-negative-float.patch", "giac-2.1.0/src/gen.cc", /return std::pow\(base\._DOUBLE_val,exponent\._DOUBLE_val\);\s*#endif\s*else\s*return exp\(exponent\*log\(base,contextptr\),contextptr\);/, "switch ( (base.type<< _DECALAGE) | exponent.type ) {"],
  ["0030-pow-half-odd-negative-float.patch", "giac-2.1.0/src/gen.cc", /\|\| base\.type==_FLOAT_ \|\| \( \(base\.type<_POLY \|\| base\.type==_FLOAT_\) && \(exponent\.type==_REAL \|\| exponent\.type==_DOUBLE_ \|\| exponent\.type==_FLOAT_\)\)\)\s*return exp\(operator_times\(exponent,log\(base,contextptr\),contextptr\),contextptr\);/, "Use matpow to force computation of a power of matrix via jordanisation"],
  // G135, patch 0019: atan keeps an exact argument on its cut symbolic (atan(2*i)), which Giac's cos rule reads on the other side
  ["0019-atan-exact-cut.patch", "giac-2.1.0/src/usual.cc", /atan\(b,contextptr\)\),_SEQ__VECT\)\);\s*gen tmp=evalf_double\(e,0,contextptr\);\s*if \(tmp\.type==_DOUBLE_\)\{/, "return symbolic(at_program,gen(makevecteur(a,0,atan(b,contextptr)),_SEQ__VECT));"],
  // G135, patch 0019: cos(atan(f)) = sqrt(1/(f^2+1)) takes the other root where f^2+1 is a negative real (cos(quote(atan(2*i))) = i*sqrt(3)/3)
  ["0019-atan-exact-cut.patch", "giac-2.1.0/src/usual.cc", /if \(u==at_atan\)\s*return sqrt\(inv\(pow\(f,2\)\+1,contextptr\),contextptr\);/, "return sqrt(1-pow(f,2),contextptr);\n      if (u==at_atan)"],
  // G96, patch 0006: symb_reim takes a non-integer power of a base of unknown sign as real (r=s, i=0)
  ["0006-reim-root-of-unknown-sign.patch", "giac-2.1.0/src/gen.cc", /is_positive\(-e,contextptr\)\)\{\s*r=pow\(-e,expo,contextptr\)\*cos\(cst_pi\*expo,contextptr\);\s*i=pow\(-e,expo,contextptr\)\*sin\(cst_pi\*expo,contextptr\);\s*\}\s*else \{\s*r=s;\s*i=0;/, "sommei.push_back(signei*(*it)*pow(r,n-j)*pow(i,j));"],
  // G176, patch 0035: limit has no rule for trunc (not in sign_floor_ceil_round_tab, no taylor), so it substitutes the point
  // (limit(trunc(x),x,-1,1) = -1, right 0)
  ["0035-limit-trunc-side.patch", "giac-2.1.0/src/series.cc", /direction=-1;\s*vecteur vsign\(loptab\(e,sign_floor_ceil_round_tab\)\);/, "static gen in_limit(const gen & e0,const identificateur & x,const gen & lim_point,int direction,GIAC_CONTEXT){"],
  ["0035-limit-trunc-side.patch", "giac-2.1.0/src/usual.cc", /sign_floor_ceil_round_tab_alias\[\]=\{\(alias_type\)&__sign,\(alias_type\)&__floor,\(alias_type\)&__ceil,\(alias_type\)&__round,\(alias_type\)&__sum,0\};/, "const alias_type sign_floor_ceil_round_tab_alias[]="],
  // G181, patch 0036: complex MPFR atanh is ln((1+e)/(1-e))/2 and atan's atanasln ln((i+e)/(i-e)), which cancel -log10|e|
  // digits for a small e (evalf(atanh(i/10^1000)) at Digits 40 was -0.5e-2000*i, evalf(atan(i/10^1000)) 0)
  ["0036-atanh-atan-small-complex.patch", "giac-2.1.0/src/usual.cc", /return e\._REALptr->atanh\(\);\s*if \( \(e\.type==_CPLX\) && \(e\.subtype \|\| e\._CPLXptr->type==_REAL\)\)\s*return no_context_evalf\(rdiv\(ln\(rdiv\(1\+e,1-e,contextptr\),contextptr\),plus_two\)\);/, "gen atanh(const gen & e0,GIAC_CONTEXT){"],
  ["0036-atanh-atan-small-complex.patch", "giac-2.1.0/src/usual.cc", /return plus_one_half\*cst_i\*ln\(rdiv\(cst_i\+e,cst_i-e,contextptr\),contextptr\);/, "static gen atanasln(const gen & e,GIAC_CONTEXT){"],
  // G169, patch 0038: a cdf's list x stays inside the formula (normald_cdf(0,1,list[1/2,3/2]) = (erf(list[…])+1)/2): the entry of
  // each cdf, icdf and UTP* has no list map (no apply2nd, no pas_ of ours); the first three of the 32 entries it adds one to
  ["0038-list-x-per-element.patch", "giac-2.1.0/src/moyal.cc", /^gen _normal_cdf\(const gen & g,GIAC_CONTEXT\)\{(?![\s\S]{0,700}(apply2nd|pas_map))/, "gen _normal_cdf(const gen & g,GIAC_CONTEXT){"],
  ["0038-list-x-per-element.patch", "giac-2.1.0/src/moyal.cc", /^gen _chisquare_cdf\(const gen & g,GIAC_CONTEXT\)\{(?![\s\S]{0,700}(apply2nd|pas_map))/, "gen _chisquare_cdf(const gen & g,GIAC_CONTEXT){"],
  ["0038-list-x-per-element.patch", "giac-2.1.0/src/moyal.cc", /^gen _UTPC\(const gen & args,GIAC_CONTEXT\)\{(?![\s\S]{0,700}(apply2nd|pas_map))/, "gen _UTPC(const gen & args,GIAC_CONTEXT){"],
  // G188, patch 0037: the integrator's propfrac step takes propf.back() of lvarx(den,x) without checking that it is not empty
  // (the view sweep's engine trapped: memory access out of bounds)
  ["0037-int-propfrac-empty-vars.patch", "giac-2.1.0/src/intg.cc", /vecteur propf=lvarx\(den,gen_x\);\s*gen_sort_f\(propf\.begin\(\),propf\.end\(\),islesscomplexthanf\);\s*nd=_quorem\(makesequence\(num,den,propf\.back\(\)\),contextptr\);/, "// Propfrac step"],
  // G179, patch 0039: int's variable (a name holding BesselJ(1,2) at 40 digits: Bad Argument Value) and fsolve's are read with what they hold
  ["0039-bound-variable-fresh-name.patch", "giac-2.1.0/src/intg.cc", /gen _integrate\(const gen & args_,GIAC_CONTEXT\)\{\s*bool setcplx=false;/, "gen _integrate(const gen & args_,GIAC_CONTEXT){"],
  ["0039-bound-variable-fresh-name.patch", "giac-2.1.0/src/solve.cc", /vecteur v\(plotpreprocess\(args,contextptr\)\);\s*gen res=undef;\s*res=in_fsolve\(v,contextptr\);/, "gen _fsolve(const gen & args,GIAC_CONTEXT){"],
  // G186, patch 0040: simplifier's search for an exact power of an integer base runs to N=int(log2 of the base's double),
  // and a base past the double range (10^330+7) has an infinite double: the loop never ends, with no interrupt check
  ["0040-simplifier-root-huge-base.patch", "giac-2.1.0/src/prog.cc", /gen b=evalf_double\(base,1,contextptr\);\s*if \(b\.type==_DOUBLE_\)\{\s*double bd=b\._DOUBLE_val;\s*bd=std::log\(bd\);\s*int N=int\(bd\/std::log\(2\.0\)\);/, "gen simplifier(const gen & g,GIAC_CONTEXT){"],
  // G187, patch 0041: a double exponent past the int range goes through int() (INT_MIN in wasm), and pow(gen,int) tests INT_MIN
  // with -exponent<0, which the compiler drops: 3.0^(-1e10) recursed until the stack overflowed
  ["0041-pow-double-exponent-int-range.patch", "giac-2.1.0/src/gen.cc", /case _DOUBLE___DOUBLE_:\s*if \(exponent\._DOUBLE_val==int\(std::floor\(exponent\._DOUBLE_val\+\.25\)\)\)/, "case _CPLX__INT_: case _IDNT__INT_:"],
  ["0041-pow-double-exponent-int-range.patch", "giac-2.1.0/src/gen.cc", /if \(exponent<0\)\{\s*if \(-exponent<0\)/, "gen pow(const gen & base, int exponent){"],
  // G170, patch 0042: ilaplace2 assumes its local name ` n` with sto, which keys the table by the name's characters, and never
  // purges it (the _purge line is commented out): every ilaplace left an entry under a freed name in VARS()
  ["0042-ilaplace-assumed-name-purged.patch", "giac-2.1.0/src/signalprocessing.cc", /sto\(gen\(makevecteur\(change_subtype\(2,1\)\),_ASSUME__VECT\),n,contextptr\);(?:(?!purge)[\s\S])*?return true;\s*\}/, "bool ilaplace2(const gen &g,const gen &s,const gen &x,gen &orig,GIAC_CONTEXT) {"],
  // G322, patch 0043: solve_ckrange drops a candidate whose evalf has an imaginary part that is_zero does not take for 0, and
  // epsilon inside solve is 10^-Digits, so the rounding of an MPFR rootof (the real root of x^3-x-1 at Digits 40) dropped it;
  // solve_inequation keeps a double test point complex by the same epsilon
  ["0043-solve-ckrange-imag-noise.patch", "giac-2.1.0/src/solve.cc", /if \(!\(isolate_mode &1\) && \( \(sol\.type==_CPLX && !is_zero\(im\(sol,contextptr\),contextptr\)\)/, "static void solve_ckrange(const identificateur & x,vecteur & v,int isolate_mode,GIAC_CONTEXT){"],
  ["0043-solve-ckrange-imag-noise.patch", "giac-2.1.0/src/solve.cc", /testval=evalf_double\(testval,1,contextptr\);\s*if \(testval\.type==_CPLX && is_zero\(\*\(testval\._CPLXptr\+1\),contextptr\)\)/, "gen testval;"],
  // G325, patch 0044: sqrt's exact complex branch normalizes the imaginary part only, so re(1-x*x) for x = sqrt(-2)-10^35 kept
  // sqrt(2)*sqrt(2) and normalize_sqrt took the sign of a nested root at Digits (asin(sqrt(-2)-10^35) the conjugate at Digits 40)
  ["0044-sqrt-complex-real-part-normal.patch", "giac-2.1.0/src/usual.cc", /a=re\(e,contextptr\);b=ratnormal\(im\(e,contextptr\),contextptr\);/, "// sqrt of an exact complex number"],
  // G340, patch 0045: algnum_convert rewrites only the rootofs lvar lists at the top level, so one inside a power kept its place and
  // the power's base was written with the generator's variable (normal(sqrt(1+sqrt(1+2^(1/3)))) = 0.00732, right 1.58218)
  ["0045-algnum-convert-nested-rootof.patch", "giac-2.1.0/src/sym2poly.cc", /v=lvar\(e\);\s*vecteur vr,wr;\s*\/\/ rewrite rootofs inside e\s*for \(int i=0;i<v\.size\(\);\+\+i\)\{\s*if \(v\[i\]\.is_symb_of_sommet\(at_rootof\)\)\{/, "int algnum_convert(const gen & e_,gen & E,gen & G,vecteur & syst,vecteur & vars,vecteur & v,vecteur & varapprox,ext_param_t & extpar,GIAC_CONTEXT){"],
  // G340f1: ... and it writes a rewritten rootof's generator as the one-argument rootof(pmin), whose x^2-rootof(pmin) the power
  // branch's _factors splits (the root set to 1) once 0045 rewrites a rootof under a power (normal(sqrt(2^(1/3)+3^(1/3))) = 1, right 1.64382803851)
  ["0045-algnum-convert-nested-rootof.patch", "giac-2.1.0/src/sym2poly.cc", /pmin\.subtype=_POLY1__VECT;\s*wr\.push_back\(horner\(p,symbolic\(at_rootof,pmin\)\)\);/, "int algnum_convert(const gen & e_,gen & E,gen & G,vecteur & syst,vecteur & vars,vecteur & v,vecteur & varapprox,ext_param_t & extpar,GIAC_CONTEXT){"],
  // G226, patch 0046: shiftrotate shifts an _INT_ with the C >> and << (the count read mod 32, a left shift wrapping into the sign bit)
  // and returns a _ZINT unchanged (shift(1,-70) = 64, shift(2^70,1) = 2^70)
  ["0046-shift-integer-exact.patch", "giac-2.1.0/src/ti89.cc", /if \(a\.type==_INT_\)\{\s*if \(right\)\s*return a\.val >> nbre;\s*else\s*return a\.val << nbre;/, "static gen shiftrotate(const gen & g,bool right){"],
  // G331, patch 0047: tsimplify_common converts each ln argument with alg_lvar's variables and goes on with an undef one (alg_lvar
  // drops ln(rootof(…))), so decompose recursed to a stack overflow (F214) or expanded_ln looped for ever
  ["0047-tsimplify-ln-undef-arg.patch", "giac-2.1.0/src/subst.cc", /vecteur vars\(alg_lvar\(argln\)\);\s*\/\/ FIXME alg_lvar for alg ext but requires decompose to work!\s*for \(int i=0;i<s;\+\+i\)\s*argln\[i\]=e2r\(argln\[i\],vars,contextptr\);\s*\/\/ extensions must be treated separately/, "vecteur vars(alg_lvar(argln));"],
  // G308, patch 0048: is_one of a complex tests its imaginary part with is_zero, which compares a float with epsilon (1e-12), so
  // 1+1e-15*i was one: pow returned the base ((1+i/10^15)^(1/3) at Digits 40), operator_times the other factor (evalf(1+i/10^15)*x = x)
  ["0048-complex-is-one-exact.patch", "giac-2.1.0/src/gen.cc", /case _CPLX:\s*return is_one\(\*a\._CPLXptr\) && is_zero\(\*\(a\._CPLXptr\+1\)\);/, "bool is_one(const gen & a){"],
  // G353, patch 0049: stddev (stddev, stddevp, variance of a list or a matrix) sums x^2 in one pass and subtracts s*mean^2, which
  // cancels in floats (variance([1.1,1.1,1.1]) = -7.1e-15 at Digits 12; a stored float list gave stddevp 1e-31*i in Home)
  ["0049-stddev-float-two-pass.patch", "giac-2.1.0/src/permu.cc", /somme = somme \+ \(\*jt\)\*\(\*jt\);\s*\}\s*if \(variance!=3\)\s*res\.push_back\(sqrt\(rdiv\(somme-s\*moyenne\[i\]\*moyenne\[i\]/, "vecteur stddev(const matrice & m,bool column,int variance){"],
  // G359, patch 0050: proot's balance and in_proot take eps1=1/(the double of the largest coefficient), 0 past the double range,
  // and convert -log(0) to int (int(+inf)): mpfr_init2 got INT_MAX bits and aborted (proot([1,0,10^400,1]) trapped the engine)
  ["0050-proot-huge-coefficients.patch", "giac-2.1.0/src/vecteur.cc", /double eps1=1\/\(evalf_double\(maxv,1,contextptr\)\._DOUBLE_val\);\s*if \(debug_infolevel\)\s*CERR << "proot coefficients ratio /, "gen bestg=accurate_evalf(gen(best),90);"],
  ["0050-proot-huge-coefficients.patch", "giac-2.1.0/src/vecteur.cc", /double eps1=1\/\(evalf_double\(maxvt,1,contextptr\)\._DOUBLE_val\);\s*if \(debug_infolevel\)\s*CERR << "proot after shift: coefficients ratio /, "gen shift(-v[1]/v[0]/int(v.size()+1));"],
  // G360, patch 0051: in_limit has no rule for iPart (no series rule, not in sign_floor_ceil_round_tab), so it substitutes the point
  ["0051-limit-ipart-as-trunc.patch", "giac-2.1.0/src/series.cc", /direction=-1;\s*vecteur vsign\(loptab\(e,sign_floor_ceil_round_tab\)\);/, "static gen in_limit(const gen & e0,const identificateur & x,const gen & lim_point,int direction,GIAC_CONTEXT){"],
  // G378, patch 0052: sym2rxrootnum takes arg(num) from evalf(num), so on the cut (a negative real num) the sign of a rounding
  // imaginary part chose the root (simplify(sqrt(acosh(-1/2)^2)) = -ln((i*sqrt(3)-1)/2))
  ["0052-sqrt-root-pick-at-cut.patch", "giac-2.1.0/src/sym2poly.cc", /if \(hasevalf\)\s*numprevf=arg\(numprevf,contextptr\);\s*for \(f_it=f\.begin\(\);/, "static bool sym2rxrootnum(vecteur & v,const vecteur & lv,gen & num,gen & tmpden,GIAC_CONTEXT){"],
  // G557, patch 0053: algnum_rewritable writes a biquadratic E as shift +- sqrt(sol) and takes the minus sign when is_positive(E-shift)
  // is false, as for any complex E (normal(sqrt(2)+i*sqrt(3)) gave its negative)
  ["0053-algnum-complex-root-sign.patch", "giac-2.1.0/src/sym2poly.cc", /e=normalize_sqrt\(e,contextptr\);\s*if \(!is_positive\(Eapproxshift,contextptr\)\)\s*e=-e;/, "gen Eapproxshift=Eapprox-shift;"],
  // ... and algnum_normal and algnum_rref write the generator as rootof([1,0],pminv) with no check that its value r is that root
  // (normal(sqrt(10^(1/3)-sqrt(6))) was a rootof worth 2.1457, right 0.5432*i)
  ["0053-algnum-complex-root-sign.patch", "giac-2.1.0/src/sym2poly.cc", /ext=rootofallowed\?algebraic_EXTension\(makevecteur\(1,0\),pminv\):rexact;\s*r=_evalf\(makesequence\(rexact,extpar\.digits\),contextptr\);\s*nums=/, "  bool algnum_normal(gen & e,GIAC_CONTEXT){\n#ifdef"],
  ["0053-algnum-complex-root-sign.patch", "giac-2.1.0/src/sym2poly.cc", /ext=rootofallowed\?algebraic_EXTension\(makevecteur\(1,0\),pminv\):rexact;\s*r=_evalf\(makesequence\(rexact,extpar\.digits\),contextptr\);\s*nums=/, "++l; ++c;"],
  // G617, patch 0054: in_sumab's branch for c*(-1)^k/k^p from a multiplies sum((-1)^k/k^p,k,a,inf) by -c*(-1)^a (the sign flipped for an
  // even a: sum((-1)^k/k^2,k,2,inf) = pi^2/12-1), and for p = 1 takes the harmonic sum off ln(2) (sum((-1)^k/k,k,3,inf) = 3/2-ln(2))
  ["0054-alternating-sum-start.patch", "giac-2.1.0/src/intgab.cc", /plus_inf\),contextptr\);\s*res = -res\*subst\(g\/R,x,a,false,contextptr\);/, "// coeff*sum((-1)^k/k^pui,k,a,inf)"],
  ["0054-alternating-sum-start.patch", "giac-2.1.0/src/intgab.cc", /res = res-_sum\(makesequence\(R,x,1,a\.val-1\),contextptr\);\s*res=res\*subst\(g\/R,x,1,false,contextptr\);/, "// coeff*sum((-1)^k/k^pui,k,a,inf)"],
  // G770 (F470), patch 0055: _integrate's 4-argument branch previews the integrand numerically for its log, which integrates an inner
  // integral at every sample point (int(int(x^2+y^2,y,0,3),x,0,2): 1.7 million interrupt checks); G787: anchored on the 4-argument test, 123
  // chars before it (from `gen _integrate(` it lies about 2,900 chars on, at the edge of the 3,000-char window in the 22 Nov tree)
  ["0055-nested-integral-no-preview.patch", "giac-2.1.0/src/intg.cc", /if \(x\.type==_IDNT && a\.type!=_DOUBLE_ && b\.type!=_DOUBLE_\)\{\s*gen v0=evalf_double\(v\[0\],1,contextptr\),resapprox,tmp;/, "if (args.type==_VECT && args._VECTptr->size()==4){"],
  // G620 (F434), patch 0056: in_limit's "Rewrite constants" step tsimplifies the numeric constants (cosh(1) to exponentials) and leaves
  // an x-dependent cosh(1+x), whose series starts with cosh(1): limit((cosh(1+x)-cosh(1))/x,x,0) = infinity
  ["0056-limit-hyperbolic-constants.patch", "giac-2.1.0/src/series.cc", /cv\.push_back\(rv\[i\]\);\s*\}\s*if \(!cv\.empty\(\)\)\{\s*gen cvg=tsimplify\(cv,contextptr\);/, "// Rewrite constants"],
  // G398, patch 0057: ln(inv(f)) = -ln(f) (and ln of the fraction 1/d, -ln(d)) and sqrt(inv(f)) = inv(sqrt(f)) for any f, the conjugate
  // for a negative real f (ln(1/(1-sqrt(2))) = -ln(1-sqrt(2)), 0.881-pi*i; sqrt(1/(pi-4)) = 1/sqrt(pi-4), -1.079*i), and G783: for a free
  // name before it has a value (ln(1/y) = -ln(y), so subst(ln(1/y),y=-2) = -ln(-2), the conjugate)
  ["0057-ln-sqrt-inv-negative-real.patch", "giac-2.1.0/src/usual.cc", /if \(e\._SYMBptr->sommet==at_inv && e\._SYMBptr->feuille\.type!=_VECT\)\s*return -ln\(e\._SYMBptr->feuille,contextptr\);[\s\S]{0,400}?if \(e\.type==_FRAC && e\._FRACptr->num==1\)\s*return -ln\(e\._FRACptr->den,contextptr\);/, "return apply_to_equal(e,ln,contextptr);"],
  ["0057-ln-sqrt-inv-negative-real.patch", "giac-2.1.0/src/usual.cc", /if \(e\.is_symb_of_sommet\(at_inv\)\)\s*return inv\(sqrt\(e\._SYMBptr->feuille,contextptr\),contextptr\);/, "return symbolic(at_program,gen(makevecteur(a,0,sqrt(b,contextptr)),_SEQ__VECT));"],
  // G786, patch 0058: ascsort (under median, quartile1, quartile3, quantile, quartiles) writes 0 for an element whose evalf is no double,
  // so a float list above 14 digits (MPFR elements) sorted as zeros (quartile1(evalf([1,2,3,4,5,6])) = 0.0 at Digits 20)
  // G786f1: the same 0 for an element with no real value (a complex: median([1+i,2+i,3+i]) = 0.0), and median, quartile1,
  // quartile3, quantile and quartiles (misc.cc) take ascsort's rows as they come, with no error
  ["0058-ascsort-mpfr-elements.patch", "giac-2.1.0/src/permu.cc", /tmp=evalf\(tmp,1,0\);\s*if \(tmp\.type!=_DOUBLE_\)\s*vv\[j\]=0;/, "matrice ascsort(const matrice & m,bool column){"],
  ["0058-ascsort-mpfr-elements.patch", "giac-2.1.0/src/misc.cc", /return mtran\(ascsort\(mtran\(vecteur\(1,v\)\),true\)\)\[int\(std::ceil\(v\.size\(\)\/4\.0\)\)-1\]\[0\];/, "gen _quartile1(const gen & g,GIAC_CONTEXT){"],
  // G789, patch 0060: median, quartile1 (and quartile3, quantile, quartiles) sort a list that is not fully numeric with
  // islesscomplexthanf_sort, by form: undef and a free name take a place, -inf comes last (median([3,1,-inf]) = 3, right 1)
  ["0060-median-list-by-value.patch", "giac-2.1.0/src/misc.cc", /if \(!is_fully_numeric\(evalf\(v,1,contextptr\)\)\)\{\s*islesscomplexthanf_sort\(v\.begin\(\),v\.end\(\)\);\s*return v\[int\(std::ceil\(v\.size\(\)\/2\.0\)\)-1\];/, "gen _median(const gen & g,GIAC_CONTEXT){"],
  ["0060-median-list-by-value.patch", "giac-2.1.0/src/misc.cc", /if \(!is_fully_numeric\(evalf\(v,1,contextptr\)\)\)\{\s*islesscomplexthanf_sort\(v\.begin\(\),v\.end\(\)\);\s*return v\[int\(std::ceil\(v\.size\(\)\/4\.0\)\)-1\];/, "gen _quartile1(const gen & g,GIAC_CONTEXT){"],
  // G399, patch 0059: arg of a power and of a product returns _smod(x,2*pi), whose range is [-pi,pi) (x-m*round(x/m), round(1/2) = 1),
  // so the arg of a negative real reached that way was -pi (arg((i*pi)^2) = 2*pi/2-2*pi, arg(i*pi*i) = pi/2+pi/2-2*pi)
  ["0059-arg-negative-real-pi.patch", "giac-2.1.0/src/gen.cc", /gen res=im\(ln\(af\._VECTptr->front\(\),contextptr\)\*af\._VECTptr->back\(\),contextptr\);\s*return _smod\(makesequence\(res,cst_two_pi\),contextptr\);/, "gen arg(const gen & a,GIAC_CONTEXT){"],
  ["0059-arg-negative-real-pi.patch", "giac-2.1.0/src/gen.cc", /if \(nonzero>1\)\s*return _smod\(makesequence\(res,cst_two_pi\),contextptr\);/, "gen arg(const gen & a,GIAC_CONTEXT){"],
  // G553, patch 0061: _floor's MPFR branch takes a negative value as its truncation when is_zero(res-tmp), an absolute 1e-12 at any
  // Digits, so ceil(pi*10^-13) = 0 and floor(-pi*10^-13) = 0 (ceil is -floor(-x), round floor(x+1/2))
  ["0061-floor-mpfr-working-precision.patch", "giac-2.1.0/src/usual.cc", /gen res=real2int\(tmp,contextptr\);\s*if \(is_strictly_positive\(-tmp,contextptr\) && !is_zero\(res-tmp,contextptr\)\)\s*return res-1;/, "static bool warnfloor=true;"],
  // G551, patch 0062: bitand, bitor and bitxor set the _INT_ beside a _ZINT with mpz_set_ui, which reads a negative int as 2^32+v
  // (bitand(-2,2^64-1) = 4294967294, bitor(-1,2^31) = 4294967295); the canary is giac_bitand's _INT___ZINT case
  ["0062-bitops-signed-small-integer.patch", "giac-2.1.0/src/misc.cc", /case _INT___ZINT:\s*e = new ref_mpz_t;\s*mpz_set_ui\(e->z,a\.val\);\s*mpz_and\(e->z,e->z,\*b\._ZINTptr\);/, "gen giac_bitand(const gen & a,const gen & b){"],
  // G554 (F305), patch 0063: numeric_matrix_exp's loop reads linfnorm(term)._DOUBLE_val, a double from an MPFR norm above Digits 14,
  // so exp of a float matrix was the identity (exp(evalf([[1,2],[3,4]])) at Digits 40)
  ["0063-matrix-exp-working-precision.patch", "giac-2.1.0/src/usual.cc", /for \(double j=2;j<max_numexp && linfnorm\(eee,contextptr\)\._DOUBLE_val>eps;\+\+j\)\{/, "static gen numeric_matrix_exp(const gen & e,double eps,GIAC_CONTEXT){"],
  // G790 (F475), patch 0064: mmult_atranb's sparse loop skips a left entry with is_zero(acur,context0), an absolute 1e-12 at any Digits
  // (and matrix_density counts zeros the same way), so a left factor of floats below 1e-12 gave the zero matrix at Digits 40
  ["0064-mmult-tiny-float-factor.patch", "giac-2.1.0/src/vecteur.cc", /const gen & acur=\*it;\s*if \(is_zero\(acur,context0\)\)\{\s*int p=1;\s*\+\+it;\s*for \(; \(it!=itend\) && is_zero\(\*it,context0\);/, "double a_density=matrix_density(a),b_density=matrix_density(btran);"],
  // G793, patch 0065: _lcm returns lcm(a,b) = normal(a/gcd(a,b))*b as it comes, the sign of the product (lcm(-4,6) = -12, lcm(-4) = -4)
  ["0065-lcm-integers-positive.patch", "giac-2.1.0/src/usual.cc", /if \(args\.type!=_VECT\)\s*return args;[\s\S]{0,300}?return apply\(\*it,\*\(it\+1\),lcm\);\s*gen res\(\*it\);\s*for \(\+\+it;it!=itend;\+\+it\)\s*res=lcm\(res,\*it\);\s*return res;/, "gen _lcm(const gen & args,GIAC_CONTEXT){"],
];

const tar = tarball(SOURCES.giac);
const failures: string[] = [];
// G153: each file is unpacked once (tar -xzOf reads the whole tarball, about 2 s); one unpack per canary took 107 s for
// 51 canaries, past the flags stage's 120 s under load.
const files = new Map<string, string>();
const read = (file: string): string => files.get(file) ?? files.set(file, member(tar, file)).get(file)!;
for (const [patch, file, wrong, near] of CANARIES) {
  const src = read(file);
  const at = src.indexOf(near);
  const body = at < 0 ? "" : src.slice(at, at + 3000);
  if (at < 0) failures.push(`${patch}: "${near}" not found in ${file}`);
  else if (!wrong.test(body)) failures.push(`${patch}: ${file} no longer has the line it fixes (upstream fixed it? drop the patch at this pin)`);
}
if (failures.length) {
  console.log(`FAIL patch-canary\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS patch-canary: ${CANARIES.length} patched cause(s) still in the pinned tarball`);
