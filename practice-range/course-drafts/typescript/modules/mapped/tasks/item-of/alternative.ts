type ItemOf<T> = T extends readonly (infer U)[] ? U : T;
