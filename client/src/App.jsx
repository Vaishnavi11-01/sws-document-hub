import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      setFetching(true);
      try {
        const response = await fetch(`${API_URL}/api/documents`);
        const data = await response.json();
        setDocuments(data);
      } catch (error) {
        console.error(error);
      } finally {
        setFetching(false);
      }
    };

    loadDocuments();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>SWS Document Hub</h1>

      <div style={{ marginTop: "20px" }}>
        <h2>Recent uploads</h2>

        {fetching ? (
          <div>Loading documents...</div>
        ) : (
          <div>
            {documents.length === 0 ? (
              <div>No uploaded documents yet.</div>
            ) : (
              documents.map((doc) => (
                <div key={doc._id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
                  <strong>{doc.name}</strong>
                  <p>{new Date(doc.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}