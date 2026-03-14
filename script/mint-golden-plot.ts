import { mintLandNft } from "../server/services/chain/land";
import { getAdminAccount } from "../server/services/chain/client";
import { db } from "../server/db";
import { plotNfts as plotNftsTable } from "../server/db-schema";

async function main() {
  const admin = getAdminAccount();
  console.log("Admin address:", admin.addr.toString());
  console.log("Minting golden plot #1...");

  const result = await mintLandNft({
    plotId: 1,
    receiverAddress: admin.addr.toString(),
    metadataBaseUrl: "https://ascendancyalgo.xyz",
  });

  console.log("✅ Minted!");
  console.log("   assetId:", result.assetId);
  console.log("   txId:", result.createTxId);
  console.log("   View: https://allo.info/asset/" + result.assetId);

  if (db) {
    await db.insert(plotNftsTable).values({
      plotId: 1,
      assetId: result.assetId,
      mintedToAddress: result.mintedToAddress,
      mintedAt: Date.now(),
    }).onConflictDoUpdate({
      target: plotNftsTable.plotId,
      set: { assetId: result.assetId, mintedToAddress: result.mintedToAddress, mintedAt: Date.now() },
    });
    console.log("✅ DB updated");
  }
}

main().catch(console.error).finally(() => process.exit(0));
