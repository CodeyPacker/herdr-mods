type ItemOf<T> = T extends (infer U)[] ? U : T;
