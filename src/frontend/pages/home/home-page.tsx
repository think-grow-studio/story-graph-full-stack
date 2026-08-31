import Link from "next/link";

const entryLinkClass =
  "inline-flex min-h-10 items-center justify-center rounded-[var(--sg-radius-sm)] px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sg-focus)] focus-visible:ring-offset-2";

export function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--sg-canvas)] text-[var(--sg-ink)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold tracking-[-0.02em]"
          href="/"
        >
          <span
            aria-hidden="true"
            className="relative size-6 rounded-full border-2 border-[var(--sg-brand)] before:absolute before:left-[5px] before:top-[5px] before:size-1.5 before:rounded-full before:bg-[var(--sg-brand)] after:absolute after:bottom-[4px] after:right-[4px] after:size-1 after:rounded-full after:bg-[var(--sg-brand)]"
          />
          Story Graph
        </Link>
        <nav aria-label="시작 메뉴" className="flex items-center gap-1 sm:gap-2">
          <Link
            className={`${entryLinkClass} text-[var(--sg-muted)] hover:bg-[var(--sg-surface)] hover:text-[var(--sg-ink)]`}
            href="/login"
          >
            로그인
          </Link>
          <Link
            className={`${entryLinkClass} bg-[var(--sg-brand)] text-white hover:bg-[var(--sg-brand-strong)]`}
            href="/signup"
          >
            시작하기
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold text-[var(--sg-brand-strong)]">
            작가를 위한 이야기 구조 작업실
          </p>
          <h1 className="text-[clamp(2.6rem,7vw,5.4rem)] font-black leading-[0.98] tracking-[-0.055em]">
            이야기는 연결될 때 선명해집니다.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[var(--sg-muted)] sm:text-lg sm:leading-8">
            인물, 관계, 사건과 설정을 한 화면에서 연결하세요. 흩어진 메모 대신
            이야기 세계의 구조를 보면서 쓰는 데 필요한 맥락을 오래 유지할 수 있습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className={`${entryLinkClass} bg-[var(--sg-brand)] px-5 text-white hover:bg-[var(--sg-brand-strong)]`}
              href="/signup"
            >
              시작하기
            </Link>
            <Link
              className={`${entryLinkClass} border border-[var(--sg-line)] bg-[var(--sg-surface)] px-5 text-[var(--sg-ink)] hover:bg-white`}
              href="/login"
            >
              로그인
            </Link>
          </div>
        </div>

        <div
          aria-label="인물과 관계가 연결된 이야기 그래프 예시"
          className="relative min-h-[430px] overflow-hidden rounded-[var(--sg-radius-lg)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 shadow-[0_20px_60px_rgba(23,25,29,0.07)] sm:min-h-[520px] sm:p-7"
          role="img"
        >
          <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[var(--sg-line)] px-5 py-4 sm:px-7">
            <div>
              <p className="text-xs font-semibold text-[var(--sg-muted)]">BOARD</p>
              <p className="mt-1 text-sm font-bold">왕관 없는 도시</p>
            </div>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--sg-brand)_10%,white)] px-3 py-1 text-xs font-semibold text-[var(--sg-brand-strong)]">
              6개의 연결
            </span>
          </div>

          <div className="absolute left-[19%] top-[37%] h-px w-[36%] origin-left rotate-[14deg] bg-[var(--sg-line)]" />
          <div className="absolute left-[48%] top-[48%] h-px w-[29%] origin-left -rotate-[24deg] bg-[var(--sg-line)]" />
          <div className="absolute left-[27%] top-[65%] h-px w-[28%] origin-left -rotate-[23deg] bg-[var(--sg-line)]" />
          <div className="absolute left-[52%] top-[53%] h-px w-[22%] origin-left rotate-[47deg] bg-[var(--sg-line)]" />

          <article className="absolute left-[8%] top-[29%] w-[38%] max-w-44 rounded-[var(--sg-radius-md)] border border-[color-mix(in_srgb,var(--sg-brand)_26%,var(--sg-line))] bg-white p-4 shadow-[0_10px_30px_rgba(23,25,29,0.06)]">
            <p className="text-[11px] font-semibold text-[var(--sg-brand-strong)]">CHARACTER</p>
            <h2 className="mt-2 text-base font-bold">이안</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--sg-muted)]">사라진 왕실 기록을 추적하는 기록관</p>
          </article>

          <article className="absolute right-[7%] top-[39%] w-[37%] max-w-44 rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-white p-4 shadow-[0_10px_30px_rgba(23,25,29,0.05)]">
            <p className="text-[11px] font-semibold text-[var(--sg-muted)]">LOCATION</p>
            <h2 className="mt-2 text-base font-bold">북문 기록소</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--sg-muted)]">봉인된 문서가 남아 있는 오래된 서고</p>
          </article>

          <article className="absolute bottom-[10%] left-[18%] w-[37%] max-w-44 rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-white p-4 shadow-[0_10px_30px_rgba(23,25,29,0.05)]">
            <p className="text-[11px] font-semibold text-[var(--sg-muted)]">SECRET</p>
            <h2 className="mt-2 text-base font-bold">붉은 장부</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--sg-muted)]">왕위 계승 기록이 조작되었다는 증거</p>
          </article>

          <div className="absolute bottom-[18%] right-[11%] rounded-full border border-[color-mix(in_srgb,var(--sg-brand)_28%,var(--sg-line))] bg-[color-mix(in_srgb,var(--sg-brand)_8%,white)] px-3 py-2 text-xs font-semibold text-[var(--sg-brand-strong)]">
            숨기고 있다 →
          </div>
        </div>
      </section>
    </main>
  );
}
