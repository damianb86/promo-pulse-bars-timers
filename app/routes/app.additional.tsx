export default function SetupPage() {
  return (
    <s-page heading="Setup">
      <s-section heading="Project baseline">
        <s-unordered-list>
          <s-list-item>Shopify React Router app template</s-list-item>
          <s-list-item>Strict TypeScript</s-list-item>
          <s-list-item>Prisma with local SQLite session storage</s-list-item>
          <s-list-item>ESLint and Prettier configured</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="External setup still required">
        <s-paragraph>
          Link this local project to a Shopify Partner organization and app
          before running embedded admin flows against a real development store.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
