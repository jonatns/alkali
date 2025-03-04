use serde::Serialize;
use std::{env, fs};
use syn::{parse_file, Expr, ExprMatch, ImplItem, Item, Lit, Pat, PatLit, Stmt, Type};

#[derive(Debug, Serialize)]
struct AbiMethod {
    name: String,
    opcode: u64,
    inputs: Vec<String>,
    outputs: Vec<String>,
}

#[derive(Debug, Serialize)]
struct AlkanesABI {
    name: String,
    methods: Vec<AbiMethod>,
}

fn extract_abi(source: &str) -> AlkanesABI {
    let syntax = parse_file(source).expect("Failed to parse Rust file");
    let mut methods = Vec::new();
    let mut contract_name = "UnknownContract".to_string();

    // Look for: impl AlkaneResponder for <ContractStruct>
    for item in syntax.items {
        if let Item::Impl(item_impl) = item {
            if let Some((_, trait_path, _)) = &item_impl.trait_ {
                // Confirm trait name is "AlkaneResponder"
                if trait_path.segments.last().unwrap().ident == "AlkaneResponder" {
                    // Get the contract struct name (e.g. "MintableAlkane")
                    if let Type::Path(struct_path) = &*item_impl.self_ty {
                        contract_name = struct_path.path.segments.last().unwrap().ident.to_string();
                    }
                    // Look for `fn execute()`
                    for impl_item in item_impl.items {
                        if let ImplItem::Fn(method) = impl_item {
                            if method.sig.ident == "execute" {
                                // Inside `execute`, find a `Stmt::Expr(Expr::Match(...), _)`
                                for stmt in &method.block.stmts {
                                    if let Stmt::Expr(Expr::Match(ExprMatch { arms, .. }), _) = stmt
                                    {
                                        // Each arm might be an opcode pattern
                                        for arm in arms {
                                            // Pattern must be a literal: Pat::Lit(PatLit { lit, .. })
                                            if let Pat::Lit(PatLit { lit, .. }) = &arm.pat {
                                                // Match the literal expression
                                                if let Lit::Int(lit_int) = lit {
                                                    let opcode: u64 =
                                                        lit_int.base10_parse().unwrap();
                                                    let method_name = format!("method_{}", opcode);

                                                    methods.push(AbiMethod {
                                                        name: method_name,
                                                        opcode,
                                                        inputs: vec![],
                                                        outputs: vec![],
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    AlkanesABI {
        name: contract_name,
        methods,
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <contract-file>", args[0]);
        std::process::exit(1);
    }

    let file_path = &args[1];
    let source = fs::read_to_string(file_path).expect("Failed to read contract file");
    let abi = extract_abi(&source);

    println!("{}", serde_json::to_string_pretty(&abi).unwrap());
}
