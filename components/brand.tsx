import Link from "next/link";
import Image from "next/image";
import logo from "@/src/assets/logo.webp";

export function Brand({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  return <Link href={href} className={`brand ${light ? "brand-light" : ""}`} aria-label="CivicSense home">
    <span className="brand-mark" aria-hidden="true"><Image src={logo} alt="" width={48} height={42} className="brand-image" priority={href === "/"}/></span>
    <span className="brand-name">civic<span>sense</span></span>
  </Link>;
}

export function CampusIllustration() {
  return <svg className="campus-art" viewBox="0 0 700 600" role="img" aria-label="Illustrated university campus courtyard">
    <rect width="700" height="600" fill="#D5D5C8"/><rect y="0" width="700" height="182" fill="#E8E4D5"/>
    <circle cx="548" cy="96" r="41" fill="#D5B96B" opacity=".67"/>
    <path d="M0 264 95 174h112l66 90v220H0V264Z" fill="#A8AA9B"/><path d="M0 269h276v25H0z" fill="#8B9083"/>
    <path d="M119 219h160v274H119z" fill="#DDD9C8"/><path d="M119 219h160v23H119z" fill="#777E72"/>
    <path d="M303 242 371 159l68 83v251H303z" fill="#5F7168"/><path d="M291 242h158v20H291z" fill="#344C40"/>
    <path d="M421 263 500 190l79 73v230H421z" fill="#C7C3B1"/><path d="M418 263h167v19H418z" fill="#86897B"/>
    <path d="M528 283h172v216H528z" fill="#9EA193"/><path d="M522 283h178v19H522z" fill="#777D70"/>
    <g fill="#48594E"><path d="M149 266h23v35h-23zM201 266h23v35h-23zM149 327h23v35h-23zM201 327h23v35h-23zM333 288h22v36h-22zM387 288h22v36h-22zM333 349h22v36h-22zM387 349h22v36h-22z"/></g>
    <g fill="#D8D4C5"><path d="M343 426h40v67h-40zM155 418h36v75h-36zM454 337h22v35h-22zM501 337h22v35h-22zM454 391h22v35h-22zM501 391h22v35h-22zM551 325h22v34h-22zM610 325h22v34h-22zM551 380h22v34h-22zM610 380h22v34h-22z"/></g>
    <path d="M0 493h700v107H0z" fill="#8B907F"/><path d="M0 530c115-22 229-25 349-4s235 18 351-2v76H0v-70Z" fill="#6F7E6D"/>
    <path d="M300 600 362 486l31 4 75 110H300Z" fill="#B9B3A1"/><path d="m333 600 42-100 22 4 59 96h-123Z" fill="#CFC9B9"/>
    <g><path d="M81 482c-14-82 5-145 31-180 27 39 38 102 13 180" fill="#3E5946"/><path d="M73 490c-35-62-40-113-25-150 38 24 58 72 50 145" fill="#536E54"/><path d="M124 493c14-61 40-98 73-109 2 44-22 84-69 117" fill="#526E53"/><path d="M108 432v105" stroke="#5E5946" strokeWidth="12"/></g>
    <g><path d="M595 494c-13-65 5-115 27-141 23 31 33 83 11 140" fill="#3F5945"/><path d="M589 494c-29-50-34-93-20-122 32 18 48 59 42 117" fill="#60775A"/><path d="M627 496c13-51 34-83 62-93 1 37-19 72-59 101" fill="#566C4D"/><path d="M612 455v74" stroke="#635D4C" strokeWidth="10"/></g>
    <g fill="#DFDCCF"><path d="M263 503h11v20h-11zM278 502h11v20h-11zM287 501h11v20h-11z"/><path d="M468 482h10v21h-10zM482 482h10v21h-10zM496 482h10v21h-10z"/></g>
    <g stroke="#9AA08F" strokeWidth="2" opacity=".7"><path d="M0 184h700M0 201h700"/></g>
  </svg>;
}
