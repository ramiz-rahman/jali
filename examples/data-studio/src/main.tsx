import { start } from "@jali-examples/shared/start";
import { createDataStudio, dataStudioOptions } from "./workspace";

start(createDataStudio(), { name: dataStudioOptions.name });
