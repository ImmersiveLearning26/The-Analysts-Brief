// Phosphor icons, bold weight (MIT). Inlined as SVG so they inherit currentColor and need no icon font.
import zoomIn from "@phosphor-icons/core/assets/bold/magnifying-glass-plus-bold.svg?raw";
import zoomOut from "@phosphor-icons/core/assets/bold/magnifying-glass-minus-bold.svg?raw";
import top from "@phosphor-icons/core/assets/bold/perspective-bold.svg?raw";
import reset from "@phosphor-icons/core/assets/bold/arrow-counter-clockwise-bold.svg?raw";
import notebook from "@phosphor-icons/core/assets/bold/notebook-bold.svg?raw";
import feedback from "@phosphor-icons/core/assets/bold/chat-circle-text-bold.svg?raw";
import settings from "@phosphor-icons/core/assets/bold/gear-six-bold.svg?raw";
import pause from "@phosphor-icons/core/assets/bold/pause-bold.svg?raw";
import play from "@phosphor-icons/core/assets/bold/play-bold.svg?raw";
import folder from "@phosphor-icons/core/assets/bold/folder-open-bold.svg?raw";
import files from "@phosphor-icons/core/assets/bold/files-bold.svg?raw";
import bank from "@phosphor-icons/core/assets/bold/bank-bold.svg?raw";
import shield from "@phosphor-icons/core/assets/bold/shield-chevron-bold.svg?raw";
import radio from "@phosphor-icons/core/assets/bold/radio-bold.svg?raw";
import market from "@phosphor-icons/core/assets/bold/storefront-bold.svg?raw";
import scroll from "@phosphor-icons/core/assets/bold/scroll-bold.svg?raw";
import close from "@phosphor-icons/core/assets/bold/x-bold.svg?raw";
import sparkle from "@phosphor-icons/core/assets/bold/sparkle-bold.svg?raw";
import mic from "@phosphor-icons/core/assets/bold/microphone-bold.svg?raw";
import send from "@phosphor-icons/core/assets/bold/arrow-up-bold.svg?raw";
import caretDown from "@phosphor-icons/core/assets/bold/caret-down-bold.svg?raw";
import tag from "@phosphor-icons/core/assets/bold/tag-bold.svg?raw";
import check from "@phosphor-icons/core/assets/bold/check-bold.svg?raw";
import minus from "@phosphor-icons/core/assets/bold/minus-bold.svg?raw";
import book from "@phosphor-icons/core/assets/bold/book-open-text-bold.svg?raw";
import eye from "@phosphor-icons/core/assets/bold/eye-bold.svg?raw";
import target from "@phosphor-icons/core/assets/bold/target-bold.svg?raw";
import globe from "@phosphor-icons/core/assets/bold/globe-hemisphere-west-bold.svg?raw";
import badge from "@phosphor-icons/core/assets/bold/identification-card-bold.svg?raw";
import map from "@phosphor-icons/core/assets/bold/map-trifold-bold.svg?raw";
import people from "@phosphor-icons/core/assets/bold/users-three-bold.svg?raw";
import podium from "@phosphor-icons/core/assets/bold/presentation-chart-bold.svg?raw";
import seal from "@phosphor-icons/core/assets/bold/seal-check-bold.svg?raw";
import pencil from "@phosphor-icons/core/assets/bold/pencil-simple-bold.svg?raw";
import clock from "@phosphor-icons/core/assets/bold/clock-bold.svg?raw";
import front from "@phosphor-icons/core/assets/bold/square-bold.svg?raw";
import iso from "@phosphor-icons/core/assets/bold/cube-bold.svg?raw";
import grid from "@phosphor-icons/core/assets/bold/dots-nine-bold.svg?raw";

const RAW = { zoomIn, zoomOut, top, reset, notebook, feedback, settings, pause, play, folder, files, bank, shield, radio,
  market, scroll, close, sparkle, mic, send, caretDown, tag, check, minus, book, eye, target, globe, badge, map, people, podium, seal, pencil, clock, front, iso, grid };

/** An icon as inline SVG markup; decorative (the control carries the accessible name). */
export const icon = (name) => (RAW[name] || "").replace("<svg ", '<svg aria-hidden="true" focusable="false" class="ph" ');
