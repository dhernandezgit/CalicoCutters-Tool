export default function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo${small ? " small" : ""}`}>
      <img src="./icono.png" alt="" className="logo-cat" />
      <span className="logo-text">CalicoCutters</span>
      {!small && <span className="logo-beta">studio</span>}
    </div>
  );
}
