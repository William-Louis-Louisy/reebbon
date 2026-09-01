# Infrastructure Layer

Cette couche contient les adaptateurs techniques qui implementent les ports de `application`.

Le stockage local est initialise par `initializeLocalStorage` : migrations SQLite, repositories et repertoires FileSystem. Les futurs renderers resteront isoles dans leurs propres adaptateurs.
