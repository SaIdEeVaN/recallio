"use client";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  LibraryBig,
  Bookmark,
  Sun,
  Moon,
  LogIn,
  Compass,
  Plus,
  Leaf,
  BookOpen,
  Layers,
  Menu,
  X,
  PanelLeft,
  Activity,
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
const navItems = [
  ["desk", "Study desk", LayoutGrid],
  ["library", "My library", LibraryBig],
  ["review", "Review queue", Bookmark],
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
        T(
          ["Source", ...modes.map((m) => m.name)].includes(parts[2])
            ? parts[2]
            : "Summary",
        );
        P("set");
      } else if (session) {
        try {
          A(await request("open", { id: parts[1] }));
          T(parts[2] || "Source");
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
  const deskTitle =
    page === "set"
      ? "Study workspace"
      : navItems.find((x) => x[0] === page)?.[1] || "Study desk";
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
        <small className="navlabel">Workspace</small>
        <nav>
          {navItems.map(([id, label, I]) => (
            <button
              key={id}
              className={"navitem " + (page === id ? "selected" : "")}
              onClick={() => {
                pageTo(id);
                refresh();
              }}
            >
              <I size={18} />
              {label}
              {id === "review" && reviewCount > 0 && (
                <span className="counter">{reviewCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebarFoot">
          <button className="navitem" onClick={() => K(!dark)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}{" "}
            {dark ? "Light theme" : "Dark theme"}
          </button>
          <button className="navitem" onClick={() => M("privacy")}>
            <ShieldCheck size={18} />
            Privacy & usage
          </button>
          <div className="account">
            <div className="avatar">
              {session ? (
                (session.user.email?.[0] || "U").toUpperCase()
              ) : (
                <Compass size={20} />
              )}
            </div>
            <div className="grow">
              <strong>{session ? "My account" : "Guest workspace"}</strong>
              <small>{session ? "Signed in" : "Exploring the sample"}</small>
            </div>
            <button
              className="square"
              aria-label={session ? "Account settings" : "Sign in"}
              onClick={() => M(session ? "account" : "signin")}
            >
              {session ? <Settings size={17} /> : <LogIn size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="area">
        <header>
          <div className="crumb">
            <button
              className="mobile square"
              aria-label="Open navigation"
              onClick={() => H(true)}
            >
              <Menu />
            </button>
            <PanelLeft className="desktop" size={16} />
            <span className="desktop">Workspace</span>
            <b className="desktop">/</b>
            <strong>{deskTitle}</strong>
          </div>
          <div>
            {session ? (
              <button className="quiet" onClick={() => M("account")}>
                <Settings size={16} />
                Account
              </button>
            ) : (
              <button className="quiet" onClick={() => M("signin")}>
                <LogIn size={16} />
                Sign in
              </button>
            )}
          </div>
        </header>
        <main id="main">
          {page === "desk" ? (
            <>
              <div className="pageIntro">
                <div>
                  <h1>
                    Your study desk<span>.</span>
                  </h1>
                  <p>
                    Turn your notes into understanding, one study set at a time.
                  </p>
                </div>
                <button className="primary" onClick={newSet}>
                  <Plus size={17} />
                  New study set
                </button>
              </div>
              <section className="hero">
                <div
                  className="heroArt"
                  role="img"
                  aria-label="Engraved botanical illustration of fern fronds growing from an open field notebook"
                />
                <div className="heroText">
                  <div className="heroLabel">
                    <span className="tinyDot" />
                    Featured study set
                  </div>
                  <h2>
                    The science of
                    <br />
                    <em>photosynthesis</em>
                  </h2>
                  <div className="heroMeta">
                    <span>
                      <Leaf size={15} />
                      Biology
                    </span>
                    <i />
                    <span>5 source sections</span>
                  </div>
                  <button
                    className="paperButton"
                    onClick={() => openStudy(demo, "Summary")}
                  >
                    <BookOpen size={17} />
                    Explore sample
                  </button>
                </div>
              </section>
              <section className="block">
                <div className="sectionHead">
                  <h2>Study tools</h2>
                  <span>Try with the sample</span>
                </div>
                <div className="toolGrid">
                  {modes.map(({ name, description, color, icon: I }) => (
                    <button
                      key={name}
                      className={"tool " + color}
                      onClick={() => openStudy(demo, name)}
                    >
                      <span className={"tileIcon " + color}>
                        <I size={23} strokeWidth={1.7} />
                      </span>
                      <h3>{name === "Tutor" ? "Ask tutor" : name}</h3>
                      <p>{description}</p>
                    </button>
                  ))}
                </div>
              </section>
              <section className="block">
                <div className="sectionHead">
                  <h2>Practice overview</h2>
                  <span>{session ? "All study sets" : "Sample activity"}</span>
                </div>
                <div className="metrics">
                  <div>
                    <Layers />
                    <b>{reviewCount}</b>
                    <span>Cards to review</span>
                  </div>
                  <div>
                    <Activity />
                    <b>{attempts.length}</b>
                    <span>Quiz attempts</span>
                  </div>
                  <div>
                    <Bookmark />
                    <b>
                      {attempts.reduce((n, a) => n + a.correct, 0)} /{" "}
                      {attempts.reduce((n, a) => n + a.answered, 0)}
                    </b>
                    <span>Correct / answered</span>
                  </div>
                </div>
              </section>
            </>
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
