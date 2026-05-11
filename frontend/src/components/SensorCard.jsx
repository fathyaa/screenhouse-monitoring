function SensorCard({ title, value, unit }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <h3
        style={{
          fontSize: "16px",
          color: "#4b5563",
          marginBottom: "10px",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: "32px",
          fontWeight: "bold",
          color: "#2f855a",
        }}
      >
        {value} {unit}
      </p>
    </div>
  );
}

export default SensorCard;