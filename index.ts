import DLMM, { BinLiquidity, LbPosition, StrategyType } from "@meteora-ag/dlmm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Connection,Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes/index.js";
import BN from "bn.js";
import { z } from "zod";
import dotenv from "dotenv"

dotenv.config({
    path:"./.env"
})
const user = Keypair.fromSecretKey(
    new Uint8Array(bs58.decode(process.env.USER_PRIVATE_KEY ||""))
);

const RPC = process.env.RPC || "https://api.devnet.solana.com";
const CLUSTER = process.env.CLUSTER || "devnet";

const connection = new Connection(RPC, "finalized");

// Load environment variables
dotenv.config();

let activeBin: BinLiquidity;
let userPositions: LbPosition[] = [];
const newBalancePosition = new Keypair();
const newImbalancePosition = new Keypair();
const newOneSidePosition = new Keypair();

// Create an MCP server
const server = new McpServer({
  name: "Cuendillar",
  version: "1.0.0",
  capabilities:{
    tools:{}
  }
});


server.tool("get-active-bin",
  "gets the active bin of the pool",
  { poolAddr: z.string() },
  async ({ poolAddr }) => {
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });
    try {
      
      activeBin = await dlmmPool.getActiveBin();
      const binData: BinLiquidity = {
        binId: activeBin.binId,
        xAmount: new BN(activeBin.xAmount),
        yAmount: new BN(activeBin.yAmount),
        supply: new BN(activeBin.supply),
        version: activeBin.version,
        price: activeBin.price,
        pricePerToken: activeBin.pricePerToken,
        feeAmountXPerTokenStored: new BN(activeBin.feeAmountXPerTokenStored),
        feeAmountYPerTokenStored: new BN(activeBin.feeAmountYPerTokenStored),
        rewardPerTokenStored: new BN(activeBin.rewardPerTokenStored)[0]
      }
      return {
        content:[{type:"text",text: JSON.stringify(binData)}]
      }
    } catch (err: unknown) {
      const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
    

  }
);

server.tool("balance-deposit-position",
  "creates a balance deposit position",
  { poolAddr: z.string(), XAmount: z.number()},
  async ({ poolAddr,XAmount }) => {
    
    
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });

    const TOTAL_RANGE_INTERVAL = 10; // 10 bins on each side of the active bin
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;
    
    const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
      Number(activeBin.price)
    );
    const totalXAmount = new BN(XAmount);
    const totalYAmount = totalXAmount.mul(new BN(Number(activeBinPricePerToken)));
    
      // Create Position
    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newBalancePosition.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });
    
    try {
      const createBalancePositionTxHash = await sendAndConfirmTransaction(
        connection,
        createPositionTx,
        [user, newBalancePosition]
      );
      return {
        content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${createBalancePositionTxHash}`}]
      }
    } catch (err: unknown) {
      const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }

);

server.tool("imbalance-deposit-position",
  "creates a imbalance deposit position",
  { poolAddr: z.string(), XAmount: z.number(),YAmount: z.number()},
  async ({poolAddr,XAmount,YAmount}) => {
    
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });
    const TOTAL_RANGE_INTERVAL = 10; // 10 bins on each side of the active bin
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    const totalXAmount = new BN(XAmount);
    const totalYAmount = new BN(YAmount);

    // Create Position
    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newImbalancePosition.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });

    try {
      const createImbalancePositionTxHash = await sendAndConfirmTransaction(
        connection,
        createPositionTx,
        [user, newImbalancePosition]
      );
      return {
        content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${createImbalancePositionTxHash}`}]
      }
    } catch (err: unknown) {
      const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.tool("create-one-side-position",
  "creates a one side deposit position on an existing pool",
  { poolAddr: z.string(), XAmount: z.number(),YAmount: z.number()},
  async ({poolAddr,XAmount,YAmount}) => {
    
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });
    const TOTAL_RANGE_INTERVAL = 10; // 10 bins on each side of the active bin
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    const totalXAmount = new BN(XAmount);
    const totalYAmount = new BN(YAmount);

    // Create Position
    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newOneSidePosition.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });
    
    try {
      const createOneSidePositionTxHash = await sendAndConfirmTransaction(
        connection,
        createPositionTx,
        [user, newOneSidePosition]
      );
      return {
        content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${createOneSidePositionTxHash}`}]
      }
    } catch (err: unknown) {
      const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.tool("get-positions-state",
"gets the positions that the user has open in the pool",
{ poolAddr: z.string() },
async ({poolAddr}) => {
  const poolAddress = new PublicKey(poolAddr);
  const dlmm = (DLMM as any).default; 
  const dlmmPool = await dlmm.create(connection, poolAddress, {
    cluster: CLUSTER,
  });

  try {
    const positionsState = await dlmmPool.getPositionsByUserAndLbPair(
      user.publicKey
    );
    userPositions = positionsState.userPositions;
    return {
      content:[{type:"text",text: JSON.stringify(userPositions)}]
    }
  } catch (err: unknown) {
      const error = err as Error;
      return {
        content:[{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      }
    }
  }
)

server.tool("add-liquidity-to-existing-position",
  "adds liquidity to an existing position",
  {poolAddr: z.string(),XAmount: z.number()},
  async ({poolAddr,XAmount}) => {
    const poolAddress = new PublicKey(poolAddr); 
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });

    const TOTAL_RANGE_INTERVAL = 10; // 10 bins on each side of the active bin
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
      Number(activeBin.price)
    );

    const totalXAmount = new BN(XAmount);
    const totalYAmount = totalXAmount.mul(new BN(Number(activeBinPricePerToken)));

    // Add Liquidity to existing position
    const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
      positionPubKey: newBalancePosition.publicKey,
      user: user.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: StrategyType.Spot,
      },
    });

    try {
      const addLiquidityTxHash = await sendAndConfirmTransaction(
        connection,
        addLiquidityTx,
        [user]
      );
        return {
          content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${addLiquidityTxHash}`}]
        }
      } catch (err: unknown) {
          const error = err as Error;
          return{
            content: [{
              type: "text",
              text: `Error: ${error.message}`
            }],
            isError: true
          };
      }
  }
);

server.tool("remove-liquidity",
  "removes liquidity from an existing position",
  {poolAddr: z.string()},
  async ({poolAddr}) => {
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });

    const removeLiquidityTxs = (
      await Promise.all(
        userPositions.map(({ publicKey, positionData }) => {
          const binIdsToRemove = positionData.positionBinData.map(
            (bin) => bin.binId
          );
          return dlmmPool.removeLiquidity({
            position: publicKey,
            user: user.publicKey,
            fromBinId: binIdsToRemove[0],
            toBinId: binIdsToRemove[binIdsToRemove.length - 1],
            bps: new BN(100 * 100),
            shouldClaimAndClose: true, // should claim swap fee and close position together
          });
        })
      )
    ).flat();



    try {
      let removeBalanceLiquidityTxHash = ""
      for (let tx of removeLiquidityTxs) {
          removeBalanceLiquidityTxHash = await sendAndConfirmTransaction(
          connection,
          tx,
          [user],
          { skipPreflight: false, preflightCommitment: "confirmed" }
        );
      }
      return {
        content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${removeBalanceLiquidityTxHash}`}]
      }
    } catch (err: unknown) {
      const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.tool("swap",
  "swap tokens in the pool",
  {poolAddr: z.string(), amountToSwap: z.number()},
  async ({poolAddr,amountToSwap}) => {
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });

    const swapAmount = new BN(amountToSwap);
    // Swap quote
    const swapYtoX = true;
    const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);

    const swapQuote = await dlmmPool.swapQuote(
      swapAmount,
      swapYtoX,
      new BN(10),
      binArrays
    );

    JSON.stringify(swapQuote);
    // Swap
    const swapTx = await dlmmPool.swap({
      inToken: dlmmPool.tokenX.publicKey,
      binArraysPubkey: swapQuote.binArraysPubkey,
      inAmount: swapAmount,
      lbPair: dlmmPool.pubkey,
      user: user.publicKey,
      minOutAmount: swapQuote.minOutAmount,
      outToken: dlmmPool.tokenY.publicKey,
    });
    try {
      const swapTxHash = await sendAndConfirmTransaction(connection, swapTx, [
        user,
      ]);
      return {
        content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${swapTxHash}`}]
      }
    } catch (err: unknown) {
      const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
      
    }  
  }
)

// claims fees from the LP
server.tool("claim-fees",
  "claims swap fees from the pool",
  {poolAddr: z.string().describe("Pool Address of the LP")},
  async ({poolAddr}) => {
    const poolAddress = new PublicKey(poolAddr);
    const dlmm = (DLMM as any).default;
    const dlmmPool = await dlmm.create(connection, poolAddress, {
      cluster: CLUSTER,
    });

    const claimFeeTxs = await dlmmPool.claimAllSwapFee({
    owner: user.publicKey,
    positions: userPositions,
  });

  try {
    let claimFeeTxHash = ""
    for (const claimFeeTx of claimFeeTxs) {
       claimFeeTxHash = await sendAndConfirmTransaction(
        connection,
        claimFeeTx,
        [user]
      );
    }
    return {
      content:[{type:"text",text: `Transaction Successfull, Transaction Hash: ${claimFeeTxHash}`}]
    }
  } catch (err: unknown) {
    const error = err as Error;
      return{
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
  }

  }
);


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Meteora MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

