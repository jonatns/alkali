use alkanes_runtime::declare_alkane;
use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::response::CallResponse;
use anyhow::Result;

#[derive(Default)]
pub struct ExampleContract(());

impl AlkaneResponder for ExampleContract {
    fn execute(&self) -> Result<CallResponse> {
        let context = self.context()?;
        let mut inputs = context.inputs.clone();
        let mut response = CallResponse::forward(&context.incoming_alkanes);

        match shift_or_err(&mut inputs)? {
            0 => Ok(response),
            44 => Ok(response),
            _ => Err(anyhow!("unrecognized opcode")),
        }
    }
}

declare_alkane! {ExampleContract}
