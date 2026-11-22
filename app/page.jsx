"use client";
import { useEffect, useState } from "react";
import {
  Bookmark,
  Sun,
  Moon,
  LogIn,
  Plus,
  BookOpen,
  FileText,
  ChevronRight,
  Menu,
  X,
  Settings,
  LogOut,
  Trash2,
  Pencil,
  Search,
  ShieldCheck,
} from "lucide-react";
import { sample } from "../lib/sample.mjs";
import { request, supabase } from "../lib/client";
import { modes, Modal } from "../components/ui";
import { SignIn, NewSet, Privacy } from "../components/Dialogs";
import Workspace from "../components/Workspace";
const studyModes = ["Source", ...modes, "Review"];
const navItems = [
  ["desk", "Study desk"],
  ["library", "My library"],
  ["review", "Review queue"],
];
function blankSample() {
  return structuredClone(sample);
}
export default function Home() {
  const [page, P] = useState("desk"),
    [tab, T] = useState("Summary"),
    [set, A] = useState(null),
    [demo, D] = useState(blankSample),
    [session, S] = useState(null),
    [library, L] = useState([]),
    [lastStudy, rememberStudy] = useState(null),
    [dialog, M] = useState(""),
    [dark, K] = useState(false),
    [side, H] = useState(false),
    [notice, N] = useState(""),
    [signInStatus, setSignInStatus] = useState(""),
    [query, Q] = useState(""),
    [target, G] = useState(null),
    [name, V] = useState(""),
    [ready, R] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("recallio.sample.v1") || "null",
      );
      if (stored?.id === "sample") D({ ...blankSample(), ...stored });
      K(localStorage.getItem("recallio.theme") === "dark");
    } catch {}
    R(true);
    const callbackFailed = [location.search, location.hash].some((part) => {
      const params = new URLSearchParams(part.slice(1));
      return (
        params.has("error") &&
        (params.has("error_code") || params.has("error_description"))
      );
    });
    if (callbackFailed) {
      history.replaceState(null, "", location.pathname);
      setSignInStatus("Sign-in was canceled or expired. Please try again.");
      M("signin");
    }
    const client = supabase();
    if (!client) return;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, s) => {
      S(s);
      if (event === "SIGNED_OUT") {
        L([]);
        A(null);
        P("desk");
      }
      if (event === "SIGNED_IN" && s) {
        setSignInStatus("");
        M((current) => (current === "signin" ? "" : current));
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (ready) {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      localStorage.setItem("recallio.theme", dark ? "dark" : "light");
    }
  }, [dark, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem("recallio.sample.v1", JSON.stringify(demo));
  }, [demo, ready]);
  async function refresh() {
    if (session)
      try {
        L(await request("list"));
      } catch (e) {
        N(e.message);
      }
  }
  useEffect(() => {
    if (session) refresh();
  }, [session?.user.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => N(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  function pageTo(p) {
    P(p);
    H(false);
    Q("");
    location.hash = p;
  }
  async function navigate(hash) {
    const parts = hash.replace(/^#/, "").split("/");
    if (parts[0] === "set" && parts[1]) {
      if (parts[1] === "sample") {
        A(null);
        T(studyModes.includes(parts[2]) ? parts[2] : "Summary");
        P("set");
      } else if (session) {
        try {
          A(await request("open", { id: parts[1] }));
          T(studyModes.includes(parts[2]) ? parts[2] : "Source");
          P("set");
        } catch (e) {
          N(e.message);
          P("library");
        }
      }
    } else if (["desk", "library", "review"].includes(parts[0])) P(parts[0]);
  }
  useEffect(() => {
    const f = () => navigate(location.hash);
    f();
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, [session?.user.id]);
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("recallio.resume." + userId),
      );
      if (saved && studyModes.includes(saved.tab))
        rememberStudy({ ...saved, userId });
    } catch {}
  }, [userId]);
  useEffect(() => {
    if (!userId || page !== "set" || !set?.id) return;
    const next = { id: set.id, tab };
    rememberStudy({ ...next, userId });
    try {
      localStorage.setItem("recallio.resume." + userId, JSON.stringify(next));
    } catch {}
  }, [userId, page, set?.id, tab]);
  function openStudy(item, mode = "Source") {
    A(item.id === "sample" ? null : item);
    P("set");
    T(mode);
    H(false);
    history.pushState(null, "", "#set/" + item.id + "/" + mode);
  }
  async function openPrivate(id, mode = "Source") {
    try {
      openStudy(await request("open", { id }), mode);
    } catch (e) {
      N(e.message);
    }
  }
  function changeSet(s) {
    if (s.id === "sample") D(s);
    else A(s);
  }
  function newSet() {
    M(session ? "new" : "signin");
  }
  async function changeItem(op) {
    try {
      if (op === "rename")
        await request("rename", { id: target.id, title: name });
      else await request("delete", { id: target.id });
      M("");
      await refresh();
    } catch (e) {
      N(e.message);
    }
  }
  const current = set || demo;
  const demoReview = demo.cards.filter((c) => c.status === "review").length;
  const reviewCount = library.reduce((n, s) => n + s.needsReview, demoReview);
  const attempts = [...library.flatMap((s) => s.attempts), ...demo.attempts];
  const rememberedSet =
    lastStudy?.userId === userId
      ? library.find(
          (item) => item.id === lastStudy?.id && item.status === "ready",
        )
      : null;
  const resumeSet =
    rememberedSet || library.find((item) => item.status === "ready");
  const reviewSets =
    library.filter((item) => item.needsReview > 0).length +
    Number(demoReview > 0);
  const activeNav = page === "set" ? (set ? "library" : "desk") : page;
  const deskTitle =
    page === "set"
      ? "My library / Study set"
      : page === "desk"
        ? "My workspace"
        : navItems.find(([id]) => id === page)?.[1];
  function libRow(s) {
    return (
      <article className="librow" key={s.id}>
        <div className="miniicon sage">
          <BookOpen />
        </div>
        <div className="grow">
          <button
            className="textButton itemName"
            onClick={() =>
              s.id === "sample" ? openStudy(demo, "Summary") : openPrivate(s.id)
            }
          >
            {s.title}
          </button>
          <small>
            {s.format} ·{" "}
            {s.id === "sample"
              ? "Interactive sample"
              : s.status + " · " + s.attempts.length + " quiz attempts"}
          </small>
        </div>
        {s.id !== "sample" && (
          <>
            <button
              className="square"
              aria-label={"Rename " + s.title}
              onClick={() => {
                G(s);
                V(s.title);
                M("rename");
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              className="square"
              aria-label={"Delete " + s.title}
              onClick={() => {
                G(s);
                M("delete");
              }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </article>
    );
  }
  function navigation(mobile = false) {
    return (
      <nav
        className={mobile ? "bottomNav" : "sideNav"}
        aria-label={mobile ? "Mobile workspace" : "Workspace"}
        hidden={mobile && side}
      >
        {navItems.map(([id, label]) => (
          <button
            key={id}
            className={"navitem " + (activeNav === id ? "selected" : "")}
            aria-current={activeNav === id ? "page" : undefined}
            onClick={() => {
              pageTo(id);
              refresh();
            }}
          >
            {label}
            {!mobile && id === "review" && reviewCount > 0 && (
              <span className="counter">{reviewCount}</span>
            )}
          </button>
        ))}
      </nav>
    );
  }
  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      {side && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => H(false)}
        />
      )}
      <aside className={side ? "sidebar open" : "sidebar"}>
        <button className="brand" onClick={() => pageTo("desk")}>
          <img alt="" src="/icon.svg" />
          Recallio
        </button>
        {navigation()}
        <div className="sidebarFoot">
          <button
            className="navitem"
            onClick={() => {
              H(false);
              M("settings");
            }}
          >
            <Settings size={18} aria-hidden="true" /> Settings
          </button>
        </div>
      </aside>
      <div className="area">
        <header>
          <span className="crumb desktop">{deskTitle}</span>
          <button className="brand mobile" onClick={() => pageTo("desk")}>
            <img alt="" src="/icon.svg" /> Recallio
          </button>
          <div className="headerActions">
            <button
              className="quiet"
              aria-label={session ? "Account" : "Sign in"}
              onClick={() => M(session ? "account" : "signin")}
            >
              {session ? (
                <span className="avatar" aria-hidden="true">
                  {(session.user.email?.[0] || "U").toUpperCase()}
                </span>
              ) : (
                <LogIn size={16} aria-hidden="true" />
              )}
              <span className={session ? "desktop" : undefined}>
                {session ? "Account" : "Sign in"}
              </span>
            </button>
            <button
              className="mobile square"
              aria-label="Open navigation"
              aria-expanded={side}
              onClick={() => H(true)}
            >
              <Menu size={19} />
            </button>
          </div>
        </header>
        <main id="main">
          {page === "desk" ? (
            <div className="studyDesk">
              <div className="deskHeading">
                <h1>Study desk</h1>
                <button className="primary" onClick={newSet}>
                  <Plus size={16} aria-hidden="true" />
                  <span>New study set</span>
                </button>
              </div>
              <div className="deskPanels">
                <section className="resumeSet" aria-labelledby="resume-heading">
                  <p className="deskLabel" id="resume-heading">
                    {resumeSet ? "Continue studying" : "Sample study set"}
                  </p>
                  <h2>{resumeSet?.title || demo.title}</h2>
                  <p>
                    {resumeSet
                      ? resumeSet.format + " · Saved study set"
                      : demo.subject +
                        " · " +
                        demo.chunks.length +
                        " source sections"}
                  </p>
                  <button
                    className="primary"
                    onClick={() =>
                      resumeSet
                        ? openPrivate(
                            resumeSet.id,
                            rememberedSet ? lastStudy.tab : "Source",
                          )
                        : openStudy(demo, "Summary")
                    }
                  >
                    {resumeSet ? "Resume study set" : "Explore sample"}
                  </button>
                </section>
                <section
                  className="deskReview"
                  aria-labelledby="review-heading"
                >
                  <div>
                    <h2 className="deskLabel" id="review-heading">
                      Review queue
                    </h2>
                    <p className="reviewTotal">
                      <strong>{reviewCount}</strong>
                      <span>
                        {reviewCount === 1 ? "card" : "cards"} to review
                        {reviewSets > 1
                          ? " across " + reviewSets + " sets"
                          : ""}
                      </span>
                    </p>
                  </div>
                  <button
                    className="outline"
                    aria-label="Open review queue"
                    onClick={() => pageTo("review")}
                  >
                    <span className="desktop">Open review queue</span>
                    <span className="mobile">Review</span>
                  </button>
                </section>
              </div>
              <section aria-labelledby="library-heading">
                <div className="deskLibraryHeading">
                  <h2 id="library-heading">My library</h2>
                  <button
                    className="textLink"
                    onClick={() => pageTo("library")}
                  >
                    View all study sets
                  </button>
                </div>
                {library.length > 0 ? (
                  <ul className="deskLibrary">
                    {library.slice(0, 3).map((studySet) => (
                      <li key={studySet.id}>
                        <button
                          aria-label={studySet.title}
                          onClick={() => openPrivate(studySet.id)}
                        >
                          <span className="deskFileIcon">
                            <FileText size={18} aria-hidden="true" />
                          </span>
                          <span className="grow">
                            <strong>{studySet.title}</strong>
                            <small>
                              {studySet.format} ·{" "}
                              {studySet.status !== "ready"
                                ? studySet.status
                                : studySet.needsReview > 0
                                  ? studySet.needsReview +
                                    (studySet.needsReview === 1
                                      ? " card to review"
                                      : " cards to review")
                                  : "Ready to study"}
                            </small>
                          </span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="deskLibraryEmpty">
                    {session
                      ? "Your saved study sets will appear here."
                      : "Sign in to save and review your own study sets."}
                  </p>
                )}
              </section>
              {resumeSet && (
                <button
                  className="textLink deskSample"
                  onClick={() => openStudy(demo, "Summary")}
                >
                  <BookOpen size={18} aria-hidden="true" /> Explore the sample
                  study set
                </button>
              )}
              {attempts.length > 0 && (
                <p className="deskActivity">
                  {attempts.length} quiz{" "}
                  {attempts.length === 1 ? "attempt" : "attempts"} ·{" "}
                  {attempts.reduce((n, a) => n + a.correct, 0)} /{" "}
                  {attempts.reduce((n, a) => n + a.answered, 0)} correct
                </p>
              )}
            </div>
          ) : page === "set" ? (
            <Workspace
              key={current.id}
              item={current}
              tab={tab}
              setTab={(m) => {
                T(m);
                history.replaceState(null, "", "#set/" + current.id + "/" + m);
              }}
              update={changeSet}
              notify={N}
              refresh={refresh}
              rename={() => {
                G(current);
                V(current.title);
                M("rename");
              }}
            />
          ) : (
            <>
              <div className="pageIntro">
                <div>
                  <div className="eyebrow">
                    <span className="dash" />
                    Workspace
                  </div>
                  <h1>
                    {page === "library" ? "My library" : "Review queue"}
                    <span>.</span>
                  </h1>
                  <p>
                    {page === "library"
                      ? "Open a saved source and pick up where you left off."
                      : "Revisit the flashcards you marked for another look."}
                  </p>
                </div>
                {page === "library" && (
                  <button className="primary" onClick={newSet}>
                    <Plus size={17} />
                    New study set
                  </button>
                )}
              </div>
              {page === "library" ? (
                <>
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="Search study sets"
                      aria-label="Search study sets"
                      value={query}
                      onChange={(e) => Q(e.target.value)}
                    />
                  </label>
                  <div className="panel">
                    {[...library, demo]
                      .filter((s) =>
                        s.title.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map(libRow)}
                    {![...library, demo].some((s) =>
                      s.title.toLowerCase().includes(query.toLowerCase()),
                    ) && <p>No study sets match this search.</p>}
                  </div>
                </>
              ) : (
                <div className="panel">
                  {reviewCount === 0 ? (
                    <div className="empty">
                      <Bookmark />
                      <h2>Your queue is clear</h2>
                      <p>Mark a flashcard “Review again” to find it here.</p>
                      <button
                        className="outline"
                        onClick={() => openStudy(demo, "Flashcards")}
                      >
                        Practice sample cards
                      </button>
                    </div>
                  ) : (
                    <>
                      {[
                        ...library.map((s) => ({ ...s, n: s.needsReview })),
                        { ...demo, n: demoReview },
                      ]
                        .filter((s) => s.n)
                        .map((s) => (
                          <article className="librow" key={s.id}>
                            <div className="grow">
                              <strong>{s.title}</strong>
                              <small>{s.n} cards to review</small>
                            </div>
                            <button
                              className="outline"
                              onClick={() =>
                                s.id === "sample"
                                  ? openStudy(demo, "Review")
                                  : openPrivate(s.id, "Review")
                              }
                            >
                              Review cards
                            </button>
                          </article>
                        ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {navigation(true)}
      {dialog === "signin" && (
        <SignIn
          initialStatus={signInStatus}
          close={() => {
            M("");
            setSignInStatus("");
          }}
        />
      )}{" "}
      {dialog === "new" && (
        <NewSet
          close={() => M("")}
          onReady={(s) => {
            M("");
            openStudy(s, "Source");
            refresh();
          }}
        />
      )}
      {dialog === "settings" && (
        <Modal title="Settings" onClose={() => M("")}>
          <div className="settingsActions">
            <button className="outline" onClick={() => K(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? "Light theme" : "Dark theme"}
            </button>
            <button className="outline" onClick={() => M("privacy")}>
              <ShieldCheck size={18} /> Privacy & usage
            </button>
          </div>
        </Modal>
      )}
      {dialog === "privacy" && <Privacy close={() => M("")} />}
      {dialog === "account" && (
        <Modal title="Account" onClose={() => M("")}>
          <p>Signed in as {session?.user.email}.</p>
          <div className="actions">
            <button
              className="outline"
              onClick={async () => {
                await supabase().auth.signOut();
                M("");
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
            <button className="outline" onClick={() => M("requestDeletion")}>
              Request account deletion
            </button>
          </div>
        </Modal>
      )}
      {dialog === "requestDeletion" && (
        <Modal title="Request account deletion?" onClose={() => M("")}>
          <p>
            This sends a deletion request to the project owner for review. You
            can remove individual study sets immediately from My library.
          </p>
          <button
            className="danger"
            onClick={async () => {
              try {
                await request("requestDeletion");
                N("Your deletion request has been recorded.");
                M("");
              } catch (e) {
                N(e.message);
              }
            }}
          >
            Submit deletion request
          </button>
        </Modal>
      )}
      {dialog === "rename" && (
        <Modal title="Rename study set" onClose={() => M("")}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await changeItem("rename");
              if (page === "set") await openPrivate(target.id, tab);
            }}
          >
            <label>
              Title
              <input
                required
                maxLength="160"
                value={name}
                onChange={(e) => V(e.target.value)}
              />
            </label>
            <button className="primary">Save title</button>
          </form>
        </Modal>
      )}
      {dialog === "delete" && (
        <Modal title="Delete this study set?" onClose={() => M("")}>
          <p>
            “{target?.title}”, its source, tools, and practice history will be
            removed from your account.
          </p>
          <div className="actions">
            <button className="outline" onClick={() => M("")}>
              Cancel
            </button>
            <button className="danger" onClick={() => changeItem("delete")}>
              Delete study set
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            className="square"
            aria-label="Dismiss message"
            onClick={() => N("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
