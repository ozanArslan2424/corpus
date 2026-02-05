export interface DBClientInterface {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}
